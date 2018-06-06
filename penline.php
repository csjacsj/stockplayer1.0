<?php
/**
 * ��JSON��ʽ���أ�1����K�ߵģ��ֱʶ������ݡ�
 * get����˵����
 * scode: stockcode  ��Ʊ����
 * ktime: k line's datetime  ��Ļ�м��Ǹ�K�ߵ�ʱ��
 * num: number  ��Ҫ������ٸ��������ݡ�
 *              �ɿͻ���ָ����һ��������Ϊ666����
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
// ���ܵ�������urldecode����Ӱ����
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
 * ���������ս��������ʵ����PDO�󶨲��ܶ�limit������Щ�������˽���ϸ���������ʣ�
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




































