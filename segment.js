/**
 * Created with JetBrains WebStorm.
 * User: csj
 * Date: 17-4-9
 * Time: 下午2:50
 * To change this template use File | Settings | File Templates.
 */

// 注意：加载本文件时，要保证window.stockplayer已经定义了
// 也就是在本文件之前先加载好stockplayer.js

(function() {

    var stockplayer;
    if (window.stockplayer) {
        stockplayer = window.stockplayer;
    } else {
        alert("window.stockplayer is not defined!!");
        return;
    }

    var segment = {};

    function SegmentIndicator() {
        // 目前前端只会增加数据。线段也不会去做删除
        // 如果担心客户端数据太多了，就重新按当前
        // 页面的时间对应的URL打开一下网页就好。
        this.vertices = [];
        this.currStockCode = null;
        // 每次请求是以显示的中间K线向左和向右各请求这么多个顶点
        this.reqRecCount = 175;
        this.leftBoundaryClear = false;
        this.rightBoundaryClear = false;
    }

    function getTimeNum(fmtDateTime) {
        var num = null;
        num = Date.parse(fmtDateTime);
        if (isNaN(num)) {
            num = Date.parse(fmtDateTime.replace(/-/g, '/'));
        }
        return num;
    }

    function findKLineIdxByTime(vertexTime, fromIdx, klines) {
        var i;
        for (i = fromIdx; i < klines.length; ++i) {
            if (getTimeNum(klines[i]["ktime"])==vertexTime) {
                return i;
            }
        }
        return null;
    }

    SegmentIndicator.prototype.render = function () {
        if (stockplayer.chart.currStockCode != this.currStockCode) {
            this.currStockCode = stockplayer.chart.currStockCode;
            this.vertices = [];
            this.leftBoundaryClear = false;
            this.rightBoundaryClear = false;
        }

        var klines = stockplayer.chart.indicators["kline"].klines['1m'];
        var beginK = klines[stockplayer.chart.beginKBarIndex];
        var endK = klines[stockplayer.chart.endKBarIndex];
        var midK = klines[Math.floor((stockplayer.chart.endKBarIndex+stockplayer.chart.beginKBarIndex)/2)];

        if (this.vertices.length == 0) {
            if (this.leftBoundaryClear && this.rightBoundaryClear) {
                return;
            } else {
                this.asyncLoadVertices(midK["ktime"]);
                return;
            }
        }

        var beginDateNum = getTimeNum(beginK["ktime"]);
        var endDateNum = getTimeNum(endK["ktime"]);

        if (getTimeNum(this.vertices[0]["ktime"]) >= beginDateNum
            && this.leftBoundaryClear == false)
        {
            this.asyncLoadVertices(midK["ktime"]);
            return;
        }

        if (getTimeNum(this.vertices[this.vertices.length-1]["ktime"]) <= endDateNum
            && this.rightBoundaryClear == false)
        {
            console.log("loading vertices, rbc=" + this.rightBoundaryClear);
            this.asyncLoadVertices(midK["ktime"]);
            return;
        }

        console.log("calling doRender");
        this.doRender();
    };

    SegmentIndicator.prototype.doRender = function () {
        if (this.currStockCode != stockplayer.chart.currStockCode) {
            alert("Segment indicator: ERROR! stockcode != chart's.");
            return;
        }

        var beginIdx=null;//指的是this.vertices中的索引
        var endIdx=null;//处理不包括这个位置

        var klines = stockplayer.chart.indicators["kline"].klines['1m'];
        var chartBeginKTime = getTimeNum(klines[stockplayer.chart.beginKBarIndex]["ktime"]);
        var chartEndKTime = getTimeNum(klines[stockplayer.chart.endKBarIndex]["ktime"]);

        var i;
        for (i = 0; i < this.vertices.length; ++i) {
            beginIdx = i;
            if (getTimeNum(this.vertices[i]["ktime"]) > chartBeginKTime) {
                break;
            }
        }
        console.log("doRender: beginIdx=" + beginIdx);
        if (beginIdx == null) {
            return;
        }
        if (beginIdx > 0) {
            --beginIdx;
        }

        console.log("doRender: beginIdx=" + beginIdx + ", vlen=" + this.vertices.length);
        for (i = beginIdx; i < this.vertices.length; ++i) {
            endIdx = i;
            if (getTimeNum(this.vertices[i]["ktime"]) > chartEndKTime) {
                break;
            }
        }
        if (endIdx == null) {
            return;
        }
        if (endIdx < beginIdx) {
            alert("Segment indicator: when do render, endIdx less than beginIdx!");
            return;
        }
        if (endIdx < this.vertices.length) {
            ++endIdx;
        }

        console.log("doRender: now trying to draw, beginIdx=" + beginIdx + ", endIdx=" + endIdx);

        var can = stockplayer.chart.canv;
        var ctx = can.getContext('2d');
        ctx.strokeStyle = "#ff6600";
        //ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        //ctx.lineWidth = 0.7;

        //ctx.setLineDash([3, 5]);//[实像素,虚像素]
        ctx.beginPath();

        var fromIdx = 0;//这指的是klines里面的索引，从这个位置往后找对应时间的K线
        var prevPos = null;
        for (i = beginIdx; i < endIdx; ++i) {
            var currPos = {};
            var v = this.vertices[i];
            var vtime = getTimeNum(v["ktime"]);
            var kIdx = findKLineIdxByTime(vtime, fromIdx, klines);
            if (kIdx == null) {
                stockplayer.alert("Segment: findKLineIdxByTime failed to find, vertex ktime: " + v["ktime"]);
                break;
            }

            var price = null;
            if (v["toporbot"] == 0) {
                price = klines[kIdx]["lowestprice"];
            } else if (v["toporbot"] == 1) {
                price = klines[kIdx]["highestprice"];
            }
            currPos["x"] = stockplayer.chart.calcCoordinateX(kIdx);
            currPos["y"] = stockplayer.chart.calcCoordinateY(price);
            currPos["toporbot"] = v["toporbot"];

            if (prevPos != null) {
                if (prevPos["toporbot"] == 0 && currPos["toporbot"] == 1) {
                } else if (prevPos["toporbot"] == 1 && currPos["toporbot"] == 0) {
                } else {
                    alert("Segment: ERROR!! Very Unusual!! prevType="
                        + prevPos["toporbot"] + "currType=" + currPos["toporbot"]
                        + "vertext ktime: " + v["ktime"]);
                    break;
                }

                ctx.moveTo(prevPos.x+0.5, prevPos.y+0.5);
                ctx.lineTo(currPos.x+0.5, currPos.y+0.5);
            }
            prevPos = currPos;
        }

        ctx.stroke();
        //ctx.setLineDash([]);
    };

    SegmentIndicator.prototype.asyncLoadVertices = function (ktime) {
        // 应该返回ktime左右各num个顶点，也就是 2*num 个顶点（如果有足够多的话）
        var scode = this.currStockCode;
        var num = this.reqRecCount;
        var url = "segment.php?scode=" + scode + "&ktime=" + encodeURIComponent(ktime) + "&num=" + num;
        var that = this;
        $.get(url, function (data, textStatus, jqXHR) {
            //console.log(data);
            var obj = JSON.parse(data);
            that.currStockCode = obj["scode"];
            that.vertices = obj.vertices;
            if (obj.hasOwnProperty("leftBoundaryClear")
                && obj["leftBoundaryClear"]==true)
            {
                that.leftBoundaryClear = true;
            }
            if (obj.hasOwnProperty("rightBoundaryClear")
                && obj["rightBoundaryClear"]==true)
            {
                that.rightBoundaryClear = true;
            }
            that.doRender();
        });
    };

    segment["SegmentIndicator"] = SegmentIndicator;

    window.stockplayer.segment = segment;

})();
