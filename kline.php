<?php
/**
 * 以JSON格式返回K线数据。
 * get参数说明：
 * s: stockcode  股票代码
 * l: level  对应的K线级别
 * d: datetime  K线的时间
 * n: number  需要请求多少根K线。
 *            由客户端指定。一般是设置为至少1000根。
 * m: mode  取值有3种：
 *          1、"f"  （focus）这种模式一般是在最初请求数据时。会尽量以指定的d时间为中心，向两边寻找紧邻的数据返回。
 *          2、"l"  （left）左模式，请求d时间以左（之前）的数据。
 *          3、"r"  （right）右模式，请求d时间以事（之后）的数据。
 *          如果没有指定，默认认为是f模式。
 */

error_reporting(E_ALL);
ini_set('display_errors', '1');

mb_internal_encoding("UTF-8");
date_default_timezone_set("Asia/Shanghai");

include_once('dbinfo.php');

$mode = "f";
if (isset($_GET['m'])) {
    $mode = $_GET['m'];
}

$retObj = ['s' => $_GET['s'],
           'l' => $_GET['l'],
           'd' => $_GET['d'],
           'n' => $_GET['n'],
           'm' => $mode];

$retObj['sname'] = "??";
$dbh = new PDO(get_stockplayer_db_dsn(), get_stockplayer_db_username(), get_stockplayer_db_password());
$dbh->query("set names 'utf8'");
$sql = "SELECT * FROM stock_brief WHERE scode=:scode";
$stmt = $dbh->prepare($sql);
$stmt->bindParam(":scode", $_GET['s']);
$stmt->execute();
$row = $stmt->fetch(PDO::FETCH_ASSOC);
if ($row)
{
    $retObj['sname'] = $row['sname'];
}

/**
 * 根据这段代码可看出，默认认为把datetime写成连在一起的数字的形式
 * 当然如果直接写成了转换后的形式应该也可以（如果URL解码正常的话。没试～）
 */
$fmtd = $_GET['d'];
if (preg_match("/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/", $_GET['d'], $matches) == 1)
{
    $fmtd = $matches[1] . "-" . $matches[2] . "-" . $matches[3] . " " . $matches[4] . ":" . $matches[5];
}

$targetCount = $_GET['n'];

$mapTableName = ['1m' => 'k1min',
                 '5m' => 'k5min',
                 '30m' => 'k30min',
                 'd' => 'kday',
                 'w' => 'kweek'];

//bool array_key_exists ( mixed $key , array $array )

// check 'd'
// $log .= "\nfmtd: " . $fmtd . "\n";

if ($mode == "f")
{
    focus_mode();
}
else if ($mode == "l")
{
    left_mode();
}
else if ($mode == "r")
{
    right_mode();
}

function focus_mode()
{
    global $dbh, $fmtd, $targetCount, $mapTableName, $retObj;
    
    $log = "";
    $timeLog = "begin time log...\n";
    $statisticBeginTime = microtime(true);
    
    $klineList = [];
    $tabname = $mapTableName[$_GET['l']];
    $halfTarget = $targetCount/2;
    
    $sql = "SELECT * FROM " . $tabname . " WHERE scode=:scode AND ktime >= '" . $fmtd . "' ORDER BY ktime LIMIT 0, " . $halfTarget;
    $log .= "\nsql: " . $sql . "\n";
    $stmt = $dbh->prepare($sql);
    $stmt->bindParam(":scode", $_GET['s']);
    $stmt->execute();
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC))
    {
        array_push($klineList, $row);
    }
    $firstHalfFull = false;
    $makeup = 0;
    $log .= "len1 " . count($klineList);
    if (count($klineList) < $halfTarget)
    {
        $makeup = $halfTarget - count($klineList);
        $log .= "; makeup1 " . $makeup;
    }
    else
    {
        $firstHalfFull = true;
    }
    $tar = $halfTarget + $makeup;
    $log .= "; tar " . $tar;
    $timeLog .= "milestone 1: " . strval(round(microtime(true)-$statisticBeginTime, 3)) . "\n";
    $sql = "SELECT * FROM " . $tabname . " WHERE scode=:scode AND ktime < '" . $fmtd . "' ORDER BY ktime DESC LIMIT 0, " . $tar;
    $stmt = $dbh->prepare($sql);
    $stmt->bindParam(":scode", $_GET['s']);
    $stmt->execute();
    $klineList2 = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC))
    {
        array_push($klineList2, $row);
    }
    //array array_reverse ( array $array [, bool $preserve_keys = false ] )
    $timeLog .= "milestone 2: " . strval(round(microtime(true)-$statisticBeginTime, 3)) . "\n";
    $klineList2 = array_reverse($klineList2);
    $klineList = array_merge($klineList2, $klineList);
    $timeLog .= "milestone 3: " . strval(round(microtime(true)-$statisticBeginTime, 3)) . "\n";
    if ((count($klineList) < $targetCount) && $firstHalfFull)
    {
        $makeup = $targetCount - count($klineList);
        $log .= "; makeup2 " . $makeup;
        $sql = "SELECT * FROM " . $tabname . " WHERE scode=:scode AND ktime >= '" . $fmtd . "' ORDER BY ktime LIMIT " . $halfTarget . ", " . $makeup;
        $stmt = $dbh->prepare($sql);
        $stmt->bindParam(":scode", $_GET['s']);
        $stmt->execute();
        $klineList2 = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC))
        {
            array_push($klineList2, $row);
        }
        $log .= "; sql " . $sql;
        $log .= "; len1 " . count($klineList);
        $log .= "; len2 " . count($klineList2);
        $klineList = array_merge($klineList, $klineList2);
        $log .= "; LEN " . count($klineList);
    }
    $timeLog .= "milestone 4: " . strval(round(microtime(true)-$statisticBeginTime, 43)) . "\n";
    $retObj['klines'] = $klineList;
    $retObj['log'] = $log;
    $timeLog .= "milestone 5: " . strval(round(microtime(true)-$statisticBeginTime, 43)) . "\n";
    $retObj['timeLog'] = $timeLog;
}

function left_mode()
{
    global $dbh, $fmtd, $targetCount, $mapTableName, $retObj;
    
    $log = "";
    
    $klineList = [];
    $tabname = $mapTableName[$_GET['l']];
    
    $sql = "SELECT * FROM " . $tabname . " WHERE scode=:scode AND ktime < '" . $fmtd . "' ORDER BY ktime DESC LIMIT 0, " . $targetCount;
    //$log .= "\nsql: " . $sql . "\n";
    $stmt = $dbh->prepare($sql);
    $stmt->bindParam(":scode", $_GET['s']);
    $stmt->execute();
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC))
    {
        array_push($klineList, $row);
    }
    $klineList = array_reverse($klineList);
    
    $retObj['klines'] = $klineList;
    $retObj['log'] = $log;
}

function right_mode()
{
    global $dbh, $fmtd, $targetCount, $mapTableName, $retObj;
    
    $log = "";
    
    $klineList = [];
    $tabname = $mapTableName[$_GET['l']];
    
    $sql = "SELECT * FROM " . $tabname . " WHERE scode=:scode AND ktime > '" . $fmtd . "' ORDER BY ktime LIMIT 0, " . $targetCount;
    //$log .= "\nsql: " . $sql . "\n";
    $stmt = $dbh->prepare($sql);
    $stmt->bindParam(":scode", $_GET['s']);
    $stmt->execute();
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC))
    {
        array_push($klineList, $row);
    }
    
    $retObj['klines'] = $klineList;
    $retObj['log'] = $log;
}

echo json_encode($retObj);

?>


































