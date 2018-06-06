<?php
/**
 * ��JSON��ʽ���أ�1����K�ߵģ��߶ζ������ݡ�
 * get����˵����
 * scode: stockcode  ��Ʊ����
 * ktime: k line's datetime  ��Ļ�м��Ǹ�K�ߵ�ʱ��
 * num: number  ��Ҫ������ٸ��������ݡ�
 *              �ɿͻ���ָ����һ��������Ϊ175����
 *              ע�⣬����ktimeָ�����Ǹ�K�ߣ�����<=����ʱ���ȡnum�����㣬
 *              ����>����ʱ��Ҳȡnum�����㣬����һ����ȡ 2*num �����㡣
 *              ��Ȼ�����������ȡ��num�������صĶ�������Ȼû����ô�ࡣ
 *              ��ʱ����������ϵ� boundery clear ��ǻᱻ���á�
 */

error_reporting(E_ALL);
ini_set('display_errors', '1');

mb_internal_encoding("UTF-8");
date_default_timezone_set("Asia/Shanghai");

include_once('dbinfo.php');

$scode = $_GET['scode'];
$ktime = $_GET['ktime'];
$num = $_GET['num'];

$retObj = ['scode' => $scode,
           'ktime' => $ktime,
           'num' => $num];

function fmtKTime($strKTime)
{
    return str_replace("-", "/", $strKTime);
}

$vertices = [];

$dbh = new PDO(get_stockplayer_db_dsn(), get_stockplayer_db_username(), get_stockplayer_db_password());
$dbh->query("set names 'utf8'");

$sql = "SELECT * FROM seg1min WHERE scode=:scode AND ktime<=:ktime ORDER BY ktime DESC LIMIT 0," . $num;

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
    $retObj['leftBoundaryClear'] = tRuE;
}

$vertices = array_reverse($vertices);

$sql = "SELECT * FROM seg1min WHERE scode=:scode AND ktime>:ktime ORDER BY ktime LIMIT 0," . $num;

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




































