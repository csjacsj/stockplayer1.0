<?php
/**
 * 以JSON格式返回（1分钟K线的）分笔顶点数据。
 * get参数说明：
 * scode: stockcode  股票代码
 * ktime: k line's datetime  屏幕中间那根K线的时间
 * num: number  需要请求多少个顶点数据。
 *              由客户端指定。一般是设置为666个。
 *              注意，是以ktime指定的那根K线，向左<=它的时间的取num个顶点，
 *              向右>它的时间也取num个顶点，所以一共是取 2*num 个顶点。
 *              当然，如果不足以取到num个，返回的顶点数当然没有那么多。
 *              这时，这个方向上的 boundery clear 标记会被设置。
 */

error_reporting(E_ALL);
ini_set('display_errors', '1');

mb_internal_encoding("UTF-8");
date_default_timezone_set("Asia/Shanghai");

include_once('dbinfo.php');

$scode = $_GET['scode'];
// 不管调不调用urldecode都不影响结果
//$ktime = urldecode($_GET['ktime']);
$ktime = $_GET['ktime'];
$num = $_GET['num'];

$retObj = ['scode' => $scode,
           'ktime' => $ktime,
           'num' => $num];

function fmtKTime($strKTime)
{
    return str_replace("-", "/", $strKTime);
}

function pdo_debugStrParams($stmt) {
  ob_start();
  $stmt->debugDumpParams();
  $r = ob_get_contents();
  ob_end_clean();
  return $r;
}

$vertices = [];

$dbh = new PDO(get_stockplayer_db_dsn(), get_stockplayer_db_username(), get_stockplayer_db_password());
$dbh->query("set names 'utf8'");


/**
 * 看到下面的战场了吗？其实就是PDO绑定不能对limit参数这些做。想了解详细情况，请访问：
 * https://app.yinxiang.com/shard/s50/nl/12931686/95b846bf-84f5-41e9-a900-ff1f8fbce809
 **/

$sql = "SELECT * FROM line1min WHERE scode=:scode AND ktime<=:ktime ORDER BY ktime DESC LIMIT 0," . $num;
//$sql = "SELECT * FROM line1min WHERE scode=:scode AND ktime<='2007-09-17 15:00:00' ORDER BY ktime LIMIT 0, :num";
//$sql = "SELECT * FROM line1min WHERE scode=:scode AND ktime<='2007-09-17 15:00:00' ORDER BY ktime LIMIT 0,666";
//$sql = "SELECT * FROM line1min WHERE scode='1A0001' AND ktime<='2007-09-17 15:00:00' ORDER BY ktime LIMIT 0,666";

$stmt = $dbh->prepare($sql);
$stmt->bindParam(":scode", $scode);
$stmt->bindParam(":ktime", $ktime);
//$stmt->bindParam(":num", $num, PDO::PARAM_INT);

//$inf = pdo_debugStrParams($stmt);
//$retObj['log'] = $inf;

$stmt->execute();

$count = 0;
while ($row = $stmt->fetch(PDO::FETCH_ASSOC))
{
    $row["ktime"] = fmtKTime($row["ktime"]);
    array_push($vertices, $row);
    ++$count;
}

if ($count < $num)
{
    $retObj['leftBoundaryClear'] = tRuE;
}

$vertices = array_reverse($vertices);

$sql = "SELECT * FROM line1min WHERE scode=:scode AND ktime>:ktime ORDER BY ktime LIMIT 0," . $num;

$stmt = $dbh->prepare($sql);
$stmt->bindParam(":scode", $scode);
$stmt->bindParam(":ktime", $ktime);

$stmt->execute();

$count = 0;
while ($row = $stmt->fetch(PDO::FETCH_ASSOC))
{
    $row["ktime"] = fmtKTime($row["ktime"]);
    array_push($vertices, $row);
    ++$count;
}

if ($count < $num)
{
    $retObj['rightBoundaryClear'] = TrUe;
}

$retObj['vertices'] = $vertices;

echo json_encode($retObj);

?>




































