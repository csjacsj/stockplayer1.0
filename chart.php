<!doctype html>
<html>
    <head>
        <meta charset="UTF-8">
    </head>
    <style type="text/css">
        
    </style>
    <link href="../csjwb/jquery-ui.css" rel="stylesheet" />
    
    <script src="../csjwb/jquery.js"></script>
    <script src="../csjwb/jquery-ui.min.js"></script>
    <script src="stockplayer.js"></script>
    <script src="penline.js"></script>
    <script src="segment.js"></script>
    
    <body>
        <div id="bgdata" style="display: none;">
<?php
            if (isset($_GET['s']))
            {
                echo "<p name=\"scode\">" . $_GET['s'] . "</p>";
            }
            if (isset($_GET['l']))
            {
                echo "<p name=\"klevel\">" . $_GET['l'] . "</p>";
            }
            if (isset($_GET['d']))
            {
                echo "<p name=\"datetime\">" . $_GET['d'] . "</p>";
            }
?>
        </div>
        <div style="font-size: 10pt; margin-bottom: 4px;">
            <span id="txtStockCode">stockcode</span>
            &nbsp;
            <span id="txtStockName">stockname</span>
            &nbsp;
            <span id="txtKLevel">klevel</span>
            &nbsp;
            <!--
<div style="margin-left: 18px; display: inline;">
-->
            <span>
                <select id="sel-ma-sys" style="margin-right: 4px;">
                    <option>一般均线系统</option>
                    <option>斐波那契均线系统</option>
                    <option>2条短期均线系统</option>
                    <option>2条长期均线系统</option>
                </select>
                <span><span><label for="ma_num_input1">MA</label></span><input id="ma_num_input1"/></span>
                <span><span><label for="ma_num_input2">MA</label></span><input id="ma_num_input2"/></span>
                <span><span><label for="ma_num_input3">MA</label></span><input id="ma_num_input3"/></span>
                <span><span><label for="ma_num_input4">MA</label></span><input id="ma_num_input4"/></span>
                <span><span><label for="ma_num_input5">MA</label></span><input id="ma_num_input5"/></span>
                <span><span><label for="ma_num_input6">MA</label></span><input id="ma_num_input6"/></span>
                <span><span><label for="ma_num_input7">MA</label></span><input id="ma_num_input7"/></span>
                <span><span><label for="ma_num_input8">MA</label></span><input id="ma_num_input8"/></span>
                <span><span><label for="ma_num_input9">MA</label></span><input id="ma_num_input9"/></span>
            <!--
</div>
-->
            </span>
        </div>
        <div><canvas id="can" width="1080px" height="680px" tabindex="0">42</canvas></div>
        <div>
            <table>
                <tr>
                    <td style="width: 180px;"><span id="inf_datetime"></span></td>
                    <td style="width: 142px;"><span id="inf_openprice"></span></td>
                    <td style="width: 142px;"><span id="inf_closeprice"></span></td>
                    <td style="width: 142px;"><span id="inf_highestprice"></span></td>
                    <td style="width: 142px;"><span id="inf_lowestprice"></span></td>
                </tr>
            </table>
            <table>
                <tr>
                    <td style="width: 142px;"><span id="inf_selarea-knum"></span></td>
                    <td style="width: 223px;"><span id="inf_selarea-beginkdate"></span></td>
                    <td style="width: 223px;"><span id="inf_selarea-endkdate"></span></td>
                </tr>
            </table>
        </div>
        <div>
            <span id="info">xxxb</span>
        </div>
        <div style="font-size: 10pt;">
            <label for="inputStockCode">StockCode:</label>
            <input type="text" id="inputStockCode" style="width: 60px;" />
            &nbsp;&nbsp;
            <label for="inputDatetime">Datetime:</label>
            <input type="text" id="inputDatetime" style="width: 130px;" />
            <input type="button" id="btnGo" value="Go!" />
            <select name="klevel" id="klevel" >
                <option>1m</option>
                <option>5m</option>
                <option>30m</option>
                <option>d</option>
                <option>w</option>
            </select>
        </div>
    </body> 
    
<script>
$( document ).ready(function() {
    $("#klevel").val("d");
    $("#btnGo").click(function(event) {
        $("#btnGo").blur();
        // send ajax request.
        // send: stock code(s), k line level(l), datetime(d)
        // l in domain: {'1m', '5m', '30m', 'd', 'w'}
        // reply: what you sent, and 1000 k lines if there exists
        // 得来点儿中文为了编码
        var url = "kline.php?s=" + $("#inputStockCode").val()
                  + "&l=" + $("#klevel").val()
                  + "&d=" + $("#inputDatetime").val()
                  + "&n=" + stockplayer.chart.nokior
                  + "&m=f";
        $.get(url, onChartData);
    });
    
    
    var can = $('#can')[0];
    stockplayer.chart.init(can);
    
    can.onmousemove = function (e) {
        stockplayer.chart.onmousemove(e);
    };
    
    can.onmousedown = function (e) {
        stockplayer.chart.onmousedown(e);
    };
    
    can.onmouseup = function (e) {
        stockplayer.chart.onmouseup(e);
    };
    
    can.onkeydown = function (e) {
        stockplayer.chart.onkeydown(e);
    };
    
    can.onkeyup = function (e) {
        stockplayer.chart.onkeyup(e);
    }
    
    var sc = $("#bgdata").children("p[name='scode']");
    if (sc.length > 0) {
        var sct = sc.text();
        var lvt = "d";
        var dtt = "1";
        var lv = $("#bgdata").children("p[name='klevel']");
        if (lv.length > 0) {
            lvt = lv.text();
        }
        var dt = $("#bgdata").children("p[name='datetime']");
        if (dt.length > 0) {
            dtt = dt.text();
        }
        var dt = $("#bgdata").children("p[name='datetime']");
        var url = "kline.php?s=" + sct
                  + "&l=" + lvt
                  + "&d=" + dtt
                  + "&n=" + stockplayer.chart.nokior
                  + "&m=f";
        $.get(url, onChartData);
    }
});

function onChartData(data, textStatus, jqXHR) {
    //console.log(data);
    var obj = JSON.parse(data);
    console.log("obj.klines.length:" + obj.klines.length);
    //console.log("obj.m: " + obj.m);
    //console.log("obj.log: " + obj.log);
    //console.log("obj.timeLog: " + obj.timeLog);
    
    if (obj.klines.length==0) {
        alert("没有返回任何K线记录");
        return;
    }
    
    stockplayer.chart.currStockCode = obj.s;
    stockplayer.chart.currStockName = obj.sname;
    $("#txtStockCode").text(stockplayer.chart.currStockCode);
    $("#txtStockName").text(stockplayer.chart.currStockName);
    $("#txtKLevel").text(stockplayer.util.getLevelName(obj.l));
    
    //将timestamp数字的obj.d转化为格式化的日期字符串
    var focus_datetime = stockplayer.util.standarize_datetime(obj.d);
    //console.log("focus_datetime: " + focus_datetime);
    
    stockplayer.chart.setup(obj.l, obj.klines);
    stockplayer.chart.currKLv = obj.l;
		var tfd = Date.parse(focus_datetime);
		if (isNaN(tfd)) {
			tfd = Date.parse(focus_datetime.replace(/-/g, '/'));
		}
    stockplayer.chart.renderFocus(tfd);
    stockplayer.chart.canv.focus();
}

</script>

</html>







































