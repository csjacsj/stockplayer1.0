(function () {
    if (window.stockplayer) {
        alert("stockplayer already defined!");
        return;
    }
    
    //console.log("defining stockplayer...");
    
    var stockplayer = {};
    
    stockplayer.Chart = (function (){
        function Chart() {
            this.indicators = {
                "kline": new KLineIndicator(),
                "vol": new VolIndicator(),
                "ma": new MAIndicator(),
                "macd": new MACDIndicator()
            };

            this.canv = null;
            this.savedImg = null;
            this.preAimedKIdx = null;
            this.selAreaBeginIdx = null;
            this.selAreaEndIdx = null;
            this.isMakingArea = null;

            this.displayScale = new DisplayScale();
            this.keyRepeater = new KeyRepeater();

            this.HPriceYCoord = null;//由价格计算在K线图上的y坐标使用的当前屏幕最高价
            this.LPriceYCoord = null;
            this.DPriceYCoord = null;
            this.coePriceYCoord = null;//由价格计算在K线图上的y坐标使用的系数
            
            this.nokior = 5000;//nokior for number of klines in one request
            this.width = 1080;
            this.height = 680;

            //以下2个是默认值，而且不会改变的
            this.priceWidth = 52;
            this.timeAxisHeight = 18;

            //这个只是初始值，用来对分割线hs1进行初始化用的
            //后面hs1可能会因为用户的移动而改变，那就和这初始值不同了
            this.indicatorHeight = 150;

            this.splitLines = {
                "vs":   {"fullname":"vertical split",
                         "x":this.width-this.priceWidth,
                         "height":this.height-3-this.timeAxisHeight},
                "hs1":  {"fullname":"horizontal split 1",
                         "y":this.height-1-this.timeAxisHeight-1-this.indicatorHeight,
                         "width":this.width-2},
                "hs2":  {"fullname":"horizontal split 2",
                         "y":this.height-1-this.timeAxisHeight,
                         "width":this.width-2}
            };

            this.displayAreas = {
                "primary":new DisplayArea("primary"),
                "secondary1":new DisplayArea("secondary1"),
                "num1":new DisplayArea("num1"),
                "num2":new DisplayArea("num2")
            };
            
            this.currStockCode = null;
            this.currStockName = null;

            //用以调整K线显示区域高度和指标1显示区域高度
            this.isDraggingHs1 = false;

            this.autoSelMA = false;

            this.secondaryIndicatorIdx = 0;
            this.secondaryIndicatorNames = ["vol", "macd"];

            this.fixedKLevelList = ['1m', '5m', '30m', 'd', 'w'];
            
            // 虽然把K线放到indicators里面，显得好像和其它指标一样平等，
            // 但其实它的特殊性还是难以抹去的，例如在Chart类中直接保存
            // 以下几个变量：
            // 这些变量可能需要在其它文件中用到，例如在chart.php中
            this.currKLv = null;
            this.beginKBarIndex = null;
            this.endKBarIndex = null;//notice that the k bar at end index is excluded when rendering

            var holderChart = this;
            
            //----------------------------------
            // Indicators
            //--(begin)-------------------------
            
            function KLineIndicator() {
                this.klines = {};//必须保证里面的任何级别下的K线都是连续的一片
            }
            
            //价格刻度单位。(price) scale units
            KLineIndicator.prototype.scaleUnits = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
            
            KLineIndicator.prototype.setup = function (lv, data) {
                this.klines[lv] = data;
            };

            /*
            KLineIndicator.prototype.get_y_by_price = function (H, p, Ht, D) {
                //return Math.floor((H-p) * (Ht-1) / D) + 1;
                return Math.floor((H-p) * Ht / D) + 1;
            };
            */
            
            //lv: 需要显示的K线级别
            //fd: focus datetime（需要类型：Date），指定显示在中间的那K线的时间
            KLineIndicator.prototype.render = function () {
                var scl = holderChart.displayScale.getScale();
                var sw = scl['s'];
                var kw = scl['k'];
                var tw = sw + kw;
                var dwidth = holderChart.getKLinesDisplayWidth();
                var beginIdx = holderChart.beginKBarIndex;
                var endIdx = holderChart.endKBarIndex;
                var lv = holderChart.currKLv;
                var klines = this.klines[lv];


                //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

                //--------------------------------
                // 绘制选中区域
                //--(begin)

                var can = holderChart.canv;
                var ctx = can.getContext('2d');
                var Ht = holderChart.displayAreas["num1"].height;

                var beginX = holderChart.displayAreas["primary"].startX + sw + Math.floor(kw/2);
                var maxX = holderChart.displayAreas["primary"].getMaxX();
                var selAreaBeginX = 1;
                var selAreaEndX = maxX;

                if (holderChart.selAreaBeginIdx && holderChart.selAreaEndIdx) {
                    // 注意，holderChart.selAreaBeginIdx 和 holderChart.selAreaEndIdx的
                    // 大小关系是不一定的，因此在这里用本地变量整顿之后再绘制
                    var selectedAreaBeginIdx = holderChart.selAreaBeginIdx;
                    var selectedAreaEndIdx = holderChart.selAreaEndIdx;
                    if (selectedAreaBeginIdx > selectedAreaEndIdx) {
                        var tmp = selectedAreaBeginIdx;
                        selectedAreaBeginIdx = selectedAreaEndIdx;
                        selectedAreaEndIdx = tmp;
                    }

                    if (selectedAreaBeginIdx >= beginIdx) {
                        selAreaBeginX = beginX + (selectedAreaBeginIdx - beginIdx) * tw - Math.floor(tw/2);
                    }
                    if (selectedAreaEndIdx <= endIdx) {
                        selAreaEndX = beginX + (selectedAreaEndIdx - beginIdx) * tw + Math.floor(tw/2);
                    }

                    //draw rect
                    ctx.fillStyle = "#a1e0fd";
                    console.log("sel area filling rect " + selAreaBeginX + ", 1, " + (selAreaEndX-selAreaBeginX) + ", " + Ht);
                    ctx.fillRect(selAreaBeginX, 1, selAreaEndX-selAreaBeginX, Ht);

                    $("#inf_selarea-knum").text("选中区域 " + (selectedAreaEndIdx-selectedAreaBeginIdx+1) + " 根K线");
                    $("#inf_selarea-beginkdate").text("开始：" + klines[selectedAreaBeginIdx]["ktime"]);
                    $("#inf_selarea-endkdate").text("结束：" + klines[selectedAreaEndIdx]["ktime"]);
                } else {
                    $("#inf_selarea-knum").text("选中区域 无");
                    $("#inf_selarea-beginkdate").text("");
                    $("#inf_selarea-endkdate").text("");
                }

                //--(end)
                // 绘制选中区域
                //--------------------------------



                //--------------------------------
                // 绘制右边的价格数字
                //--(begin)
                
                // find highest and lowest prices
                //var H = 0;
                //var L = Number.MAX_VALUE;
                /*
                for (i = beginIdx; i < endIdx; ++i) {
                    var h = Number(klines[i].highestprice);
                    var l = Number(klines[i].lowestprice);
                    if (H < h) {
                        H = h;
                    }
                    if (L > l) {
                        L = l;
                    }
                }
                */

                //draw price scale lines
                //var color = 'gray';
                var color = '#aaaaaa';
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                ctx.fillStyle = 'black';
                ctx.font = "12px Arial";
                var ld = ctx.getLineDash();
                //alert(typeof(ld) + "\r\n" + ld.length);
                //ctx.setLineDash([2, 5]);//[实像素,虚像素]
                ctx.setLineDash([0.5, 7]);//[实像素,虚像素]
                ctx.beginPath();
                
                var H = holderChart.HPriceYCoord;
                var L = holderChart.LPriceYCoord;
                var D = holderChart.DPriceYCoord;
                var scaleUnits = this.scaleUnits;
                var i;
                for (i = 0; i < scaleUnits.length; ++i) {
                    var num = D / scaleUnits[i];
                    var p = Ht / num;//p for pixel
                    if (p > 72) {
                        break;
                    }
                }
                var r = H % scaleUnits[i];
                var currPrice = H-r;
                while (currPrice > L) {
                    //py for price's y coordinate
                    //var py = get_y_by_price(currPrice-L, D, Ht);
                    //var py = this.get_y_by_price(H, currPrice, Ht, D);
                    var py = holderChart.calcCoordinateY(currPrice);
                    ctx.moveTo(1.5, py+0.5);
                    ctx.lineTo(dwidth+0.5, py+0.5);
                    ctx.fillText(currPrice.toFixed(2), dwidth+6.5, py+4.5);
                    currPrice -= scaleUnits[i];
                }
                ctx.stroke();
                
                //restore line dash
                
                //ctx.setLineDash(ld);
                ctx.setLineDash([]);
                
                //--(end)
                // 绘制右边的价格数字
                //--------------------------------
                
                //--------------------------------
                //draw k lines
                //--(begin)
                
                var currX = beginX;
                maxX = holderChart.displayAreas["primary"].getMaxX();
                var renderedKNum = 0;
                
                for (i = beginIdx; i < endIdx; ++i) {
                    var kline = klines[i];
                    var cp = Number(kline.closeprice);
                    var op = Number(kline.openprice);
                    var hp = Number(kline.highestprice);
                    var lp = Number(kline.lowestprice);
                    //var yopen = this.get_y_by_price(H,op, Ht, D);
                    var yopen = holderChart.calcCoordinateY(op);
                    //var yclose = this.get_y_by_price(H, cp, Ht, D);
                    var yclose = holderChart.calcCoordinateY(cp);
                    //var ylow = this.get_y_by_price(H, lp, Ht, D);
                    var ylow = holderChart.calcCoordinateY(lp);
                    //var yhigh = this.get_y_by_price(H, hp, Ht, D);
                    var yhigh = holderChart.calcCoordinateY(hp);
                    if (currX + Math.ceil(kw/2) + 1 < maxX) {
                        if (cp > op) {
                            drawUpKBar(ctx, "red", kw, currX, yopen, yclose, yhigh, ylow);
                        } else {
                            drawDownKBar(ctx, "green", kw, currX, yopen, yclose, yhigh, ylow);
                        }
                        ++renderedKNum;
                    }
                    currX += tw;
                }

                console.log(renderedKNum.toString() + " klines rendered.");
                
                //--(end)
                //draw k lines
                //--------------------------------
                
                //draw time axis (only for glancing referring)
                drawTimeAxis(can);
                
                //------------------------------

                // 参数 x 是影线的x坐标；注意hY和lY的高低指的是价格在显示时的高低，因此在数值上有hY<=lY
                function drawUpKBar(ctx, color, w, x, openY, closeY, hY, lY)
                {
                    // w should be odd number
                    if (w < 3) {
                        ctx.strokeStyle = color;
                        ctx.lineWidth=1;
                        ctx.beginPath();
                        ctx.moveTo(x+0.5, hY+0.5);
                        ctx.lineTo(x+0.5, lY+0.5);
                        if (w > 1) {
                            ctx.moveTo(x+1.5, hY+0.5);
                            ctx.lineTo(x+1.5, lY+0.5);
                        }
                        ctx.stroke();
                    } else {
                        var x0 = x - Math.floor(w/2);
                        var d = openY - closeY;
                        ctx.strokeStyle = color;
                        ctx.lineWidth=1;
                        ctx.strokeRect(x0+0.5, closeY+0.5, w-1, d);
                        ctx.beginPath();
                        ctx.moveTo(x+0.5, hY+0.5);
                        ctx.lineTo(x+0.5, closeY+0.5);
                        ctx.moveTo(x+0.5, openY+0.5);
                        ctx.lineTo(x+0.5, lY+0.5);
                        ctx.stroke();
                    }
                }
                
                function drawDownKBar(ctx, color, w, x, openY, closeY, hY, lY)
                {
                    if (w < 3) {
                        ctx.strokeStyle = color;
                        ctx.lineWidth=1;
                        ctx.beginPath();
                        ctx.moveTo(x+0.5, hY+0.5);
                        ctx.lineTo(x+0.5, lY+0.5);
                        if (w > 1) {
                            ctx.moveTo(x+1.5, hY+0.5);
                            ctx.lineTo(x+1.5, lY+0.5);
                        }
                        ctx.stroke();
                    } else {
                        var x0 = x - Math.floor(w/2);
                        var d = closeY - openY;
                        ctx.strokeStyle = color;
                        ctx.lineWidth=1;
                        ctx.fillStyle = color;
                        ctx.fillRect(x0, openY, w, d+1);
                        ctx.beginPath();
                        ctx.moveTo(x+0.5, hY+0.5);
                        ctx.lineTo(x+0.5, openY+0.5);
                        ctx.moveTo(x+0.5, closeY+0.5);
                        ctx.lineTo(x+0.5, lY+0.5);
                        ctx.stroke();
                    }
                }
                
                //draw time axis, only for glancing referring
                function drawTimeAxis(can)
                {
                    ctx.fillStyle = 'black';

                    var dinf = getTimeAxisDispInfo(lv, tw);
                    var useUnit = dinf.useUnit;
                    var useStep = dinf.useStep;
                    var rw = getRefWidth(useUnit);

                    var prev;
                    var currX = 1 + sw + Math.floor(kw/2);
                    var i;
                    for (i = beginIdx; i < endIdx; ++i) {
                        var kline = klines[i];
                        var fmt = formatTimeText(kline['ktime'], useUnit);
                        var mw = getNormalTextWidth(ctx, fmt.fmttxt);
                        var hmw = mw/2;
                        if (prev==undefined) {
                            if (currX-hmw > 6 && isAlignMeet(useStep, fmt.r)) {
                                prev = drawFmt(ctx, fmt, currX);
                            }
                        } else {
                            var dinf = getDistanceInfoByFmt(fmt, prev.fmt);
                            if (useUnit=="hm") {
                                if (isDistanceAsStep(dinf, useStep) && currX + hmw < 1 + dwidth) {
                                    if (dinf.diffYear) {
                                        fmt = formatTimeText(kline['ktime'], "year");
                                        prev = drawJumpFmt(ctx, fmt, currX);
                                    } else if (dinf.diffMonth) {
                                        fmt = formatTimeText(kline['ktime'], "month");
                                        prev = drawJumpFmt(ctx, fmt, currX);
                                    } else if (dinf.diffDay) {
                                        fmt = formatTimeText(kline['ktime'], "day");
                                        prev = drawJumpFmt(ctx, fmt, currX);
                                    } else {
                                        prev = drawFmt(ctx, fmt, currX);
                                    }
                                }
                            } else {
                                if (currX - hmw - prev.endX > rw && currX + hmw < 1 + dwidth) {
                                    if (dinf.diffYear && isUseUnitLt(useUnit, "year")) {
                                        fmt = formatTimeText(kline['ktime'], "year");
                                        mw = getJumpTextWidth(ctx, fmt.fmttxt);
                                        hmw = mw/2;
                                        if (currX - hmw - prev.endX > getRefWidth("year") && currX + hmw < 1 + dwidth) {
                                            prev = drawJumpFmt(ctx, fmt, currX);
                                        }
                                    } else if (dinf.diffMonth && isUseUnitLt(useUnit, "month")) {
                                        fmt = formatTimeText(kline['ktime'], "month");
                                        mw = getJumpTextWidth(ctx, fmt.fmttxt);
                                        hmw = mw/2;
                                        if (currX - hmw - prev.endX > getRefWidth("month") && currX + hmw < 1 + dwidth) {
                                            prev = drawJumpFmt(ctx, fmt, currX);
                                        }
                                    } else if (dinf.diffDay && isUseUnitLt(useUnit, "day")) {
                                        fmt = formatTimeText(kline['ktime'], "day");
                                        mw = getJumpTextWidth(ctx, fmt.fmttxt);
                                        hmw = mw/2;
                                        if (currX - hmw - prev.endX > getRefWidth("day") && currX + hmw < 1 + dwidth) {
                                            prev = drawJumpFmt(ctx, fmt, currX);
                                        }
                                    } else {
                                        if (fmt.fmttxt != prev.text) {
                                            prev = drawFmt(ctx, fmt, currX);
                                        }
                                    }
                                }
                            }
                        }
                        currX += tw;
                    }
                    
                    //--------------------------
                    function drawFmt(ctx, fmt, currX) {
                        //console.log("drawFmt");
                        return innerDrawFmt(ctx, 'black', getNormalTextFontStr(), fmt, currX);
                    }
                    
                    function drawJumpFmt(ctx, fmt, currX) {
                        return innerDrawFmt(ctx, '#004cff', getJumpTextFontStr(), fmt, currX);
                    }
                    
                    function innerDrawFmt(ctx, color, fontstr, fmt, currX) {
                        ctx.strokeStyle = color;
                        ctx.lineWidth=1;
                        ctx.fillStyle = color;
                        ctx.font = fontstr;
                        var prev = {};
                        var timeText = fmt.fmttxt;
                        var mtinterface = ctx.measureText(timeText);//mt for measure text
                        var mw = mtinterface.width;
                        var hmw = mw/2;
                        //var chh = stockplayer.chart.height;
                        var chh = holderChart.height;
                        ctx.fillText(timeText, currX-hmw, chh-5);
                        prev.endX = currX + hmw;
                        prev.text = timeText;
                        prev.fmt = fmt;
                        return prev;
                    }
                    
                    function getNormalTextWidth(ctx, text) {
                        return getTextWidth(ctx, getNormalTextFontStr(), text);
                    }
                    
                    function getJumpTextWidth(ctx, text) {
                        return getTextWidth(ctx, getJumpTextFontStr(), text);
                    }
                    
                    function getNormalTextFontStr() {
                        return "12px Arial";
                    }
                    
                    function getJumpTextFontStr() {
                        return "Bold 12px Arial";
                    }
                    
                    function getTextWidth(ctx, fontstr, text) {
                        var refont = ctx.font;
                        ctx.font = fontstr;
                        var mtinterface = ctx.measureText(text);//mt for measure text
                        var mw = mtinterface.width;
                        ctx.font = refont;
                        return mw;
                    }
                    
                    function getRefWidth(useUnit) {
                        return 1.5 * getTypicalWidth(useUnit);
                    }
                    
                    //sg for 'so called greater'...
                    function isUseUnitLt(useUnit, sgUnit) {
                        if (sgUnit == "year" && (useUnit == "month" || useUnit == "day" || useUnit == "hm")) {
                            return true;
                        } else if (sgUnit == "month" && (useUnit == "day" || useUnit == "hm")) {
                            return true;
                        } else if (sgUnit == "day" && (useUnit == "hm")) {
                            return true
                        }
                        return false;
                    }
                    
                    function getDistanceInfoByFmt(fmt, prevFmt) {
                        //首先，这里假定一定满足fmt比prevFmt是更迟的时间
                        var r1 = fmt.r;
                        var r2 = prevFmt.r;
                        var dmin = Number(r1[5]) - Number(r2[5]);
                        var dh = Number(r1[4]) - Number(r2[4]);
                        var diffYear = false;
                        var diffMonth = false;
                        var diffDay = false;
                        if (r1[1]!=r2[1]) {
                            diffYear = true;
                        }
                        if (r1[2]!=r2[2]) {
                            diffMonth = true;
                        }
                        if (r1[3]!=r2[3]) {
                            diffDay = true;
                        }
                        var dtm;//distance of total minute, at most 60 to make sence
                        /** 当然，实际上可以返回大于60。就一天来说，最大的可能是240
                        *** 对于不是同一天的情况，自动地认为后面的交易日是紧接在前面
                        *** 的交易日后面的那天。
                        **/
                        if (!diffYear && !diffMonth && !diffDay) {
                            dtm = dh*60+dmin;
                            //正常情况下，出现这种情况只能是因为下午减上午，所以要减掉中午的90分钟
                            if (dtm >= 90) {
                                dtm -= 90;
                            }
                        } else {
                            //把次一交易日的9:30做成「同前一交易日的15:00相当」来减
                            dh+=5;
                            dmin+=30;
                            dtm = dh*60+dmin;
                            if (dtm >= 90) {
                                dtm -= 90;
                            }
                        }
                        //显然，对于不是同一天的情况，dtm将是undefined
                        return {"dtm":dtm, "diffYear":diffYear, "diffMonth":diffMonth, "diffDay":diffDay};
                    }
                    
                    function isDistanceAsStep(dinf, useStep) {
                        //console.log("isDistanceAsStep, ");
                        if (useStep == "5m") {
                            return (dinf.dtm == 5);
                        } else if (useStep == "10m") {
                            return (dinf.dtm == 10);
                        } else if (useStep == "30m") {
                            return (dinf.dtm == 30);
                        } else if (useStep == "1h") {
                            return (dinf.dtm == 60);
                        }
                        return false;
                    }
                    
                    function isAlignMeet(useStep, r) {
                        var nmin = Number(r[5]);
                        if (useStep == "5m") {
                            return (nmin % 5 == 0);
                        } else if (useStep == "10m") {
                            return (nmin % 10 == 0);
                        } else if (useStep == "30m") {
                            return (nmin % 30 == 0);
                        } else if (useStep == "1h") {
                            return (nmin == 0);
                        }
                        return true;
                    }
                    
                    function getTypicalWidth(useUnit) {
                        //var can = $('#can')[0];
                        //var ctx = can.getContext('2d');
                        var ts = getTypicalString(useUnit);
                        return ctx.measureText(ts).width;
                    }
                    
                    function getTypicalString(useUnit) {
                        if (useUnit == "hm") {
                            return "10:30";
                        } else if (useUnit == "day") {
                            return "15";
                        } else if (useUnit == "month") {
                            return "Oct";
                        } else if (useUnit == "year") {
                            return "2005";
                        }
                        return "12345";
                    }
                    
                    function formatTimeText(fullText, useUnit) {
                        // 2012-01-10 15:00:00
                        var reg = new RegExp("^(\\d+)-(\\d+)-(\\d+) (\\d+):(\\d+):(\\d+)$");
                        r = fullText.match(reg);
                        var fmttxt;
                        if(r==null) {
                            holderChart.alert("Error: formatTimeText(fullText, useUnit) can't match!!");
                            fmttxt = "error!!";
                            return {"fmttxt":fmttxt, "r":r};
                        }
                        if (useUnit=="hm") {
                            fmttxt = r[4] + ":" + r[5];
                        } else if (useUnit=="day") {
                            fmttxt = r[3];
                        } else if (useUnit=="month") {
                            fmttxt = formatMonthString(r[2]);
                        } else if (useUnit=="year") {
                            fmttxt = r[1];
                        }
                        return {"fmttxt":fmttxt, "r":r};
                    }
                    
                    function formatMonthString(numtxt) {
                        var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                        var n = Number(numtxt);
                        return m[n-1];
                    }
                    
                    function getTimeAxisDispInfo(lv, tw) {
                        //console.log("getTimeAxisDispInfo, lv="+lv+", tw="+tw);
                        
                        var useUnit = "hm";
                        var useStep = "5m";
                        
                        if (lv == "1m") {
                            if (tw*5 > 55) {
                                useUnit = "hm";
                                useStep = "5m";
                            } else if (tw*5 > 25) {
                                useUnit = "hm";
                                useStep = "10m";
                            } else if (tw*5 > 5) {
                                useUnit = "hm";
                                useStep = "30m";
                            } else {
                                useUnit = "hm";
                                useStep = "30m";
                            }
                        } else if (lv == "5m") {
                            if (tw*5 > 50) {
                                useUnit = "hm";
                                useStep = "30m";
                            } else if (tw*5 > 25) {
                                useUnit = "hm";
                                useStep = "1h";
                            } else if (tw*5 > 5) {
                                useUnit = "day";
                                useStep = "days";
                            } else {
                                useUnit = "day";
                                useStep = "days";
                            }
                        } else if (lv == "30m") {
                            if (tw*5 > 55) {
                                useUnit = "day";
                                useStep = "days";
                            } else if (tw*5 > 25) {
                                useUnit = "day";
                                useStep = "days";
                            } else if (tw*5 > 5) {
                                useUnit = "day";
                                useStep = "days";
                            } else {
                                useUnit = "day";
                                useStep = "days";
                            }
                        } else if (lv == "d") {
                            if (tw*5 > 55) {
                                useUnit = "month";
                                useStep = "months";
                            } else if (tw*5 > 25) {
                                useUnit = "month";
                                useStep = "months";
                            } else if (tw*5 > 5) {
                                useUnit = "month";
                                useStep = "months";
                            } else {
                                useUnit = "month";
                                useStep = "months";
                            }
                        } else if (lv == "w") {
                            if (tw*5 > 55) {
                                useUnit = "month";
                                useStep = "months";
                            } else if (tw*5 > 25) {
                                useUnit = "month";
                                useStep = "months";
                            } else if (tw*5 > 5) {
                                useUnit = "year";
                                useStep = "years";
                            } else {
                                useUnit = "year";
                                useStep = "years";
                            }
                        } else if (lv == "month") {
                            if (tw*5 > 55) {
                                useUnit = "year";
                                useStep = "years";
                            } else if (tw*5 > 25) {
                                useUnit = "year";
                                useStep = "years";
                            } else if (tw*5 > 5) {
                                useUnit = "year";
                                useStep = "years";
                            } else {
                                useUnit = "year";
                                useStep = "years";
                            }
                        } else {
                            useUnit = "year";
                            useStep = "5y";
                        }
                        
                        var retObj = {"useUnit":useUnit, "useStep":useStep};
                        //console.log("returning: " + JSON.stringify(retObj));
                        return retObj;
                    }
                }
                
            };
            
            function VolIndicator() {
                this.mavol1 = 5;
                this.mavol2 = 10;
            }

            VolIndicator.prototype.setup = function (ma1, ma2) {
                this.mavol1 = ma1;
                this.mavol2 = ma2;
            };

            /* 成交量
             * 如果比上一个交易日成交量增加（放量），就显示为白心红条，
             * 反过来如果缩量就显示为实心绿条。这是东方财富的做法，我认为
             * 挺好的。还有一种是TradeView的做法，其颜色是跟随对应那条K线，
             * 我认为这种就不那么好。
             */
            VolIndicator.prototype.render = function (beginIdx, endIdx) {
                /*
                console.log("idc names: ");
                for (var n in this.secondaryIndicatorNames) {
                    console.log(n);
                }
                console.log("idc idx: " + this.secondaryIndicatorIdx);
                console.log("idc currName: " + this.secondaryIndicatorNames[this.secondaryIndicatorIdx]);
                */
                if (holderChart.secondaryIndicatorNames[
                        holderChart.secondaryIndicatorIdx] != "vol") {
                    return;
                }

                var beginIdx = holderChart.beginKBarIndex;
                var endIdx = holderChart.endKBarIndex;
                var lv = holderChart.currKLv;
                var klines = holderChart.indicators["kline"].klines[lv];
                var scl = holderChart.displayScale.getScale();
                var sw = scl['s'];
                var kw = scl['k'];
                var tw = sw + kw;
                var da = holderChart.displayAreas["secondary1"];
                var dwidth = da.width;
                //console.log("secondary1 da.height: " + da.height);

                /* ====================================================
                 * 重点注意：
                 * 成交量(volume)从1分钟到周线级别都是以手为单位，
                 * 而对于成交金额(turnover)，
                 * 对于1分钟K线，其成交金额是以元为单位
                 * 而对于5分钟及以上级别的K线，是以万元为单位
                 ====================================================*/
                var L = 0;
                var H = 0;
                var i;
                for (i = beginIdx; i < endIdx; ++i) {
                    var v = Number(klines[i]["volume"]);
                    if (v > H) {
                        H = v;
                    }
                }

                var ctx = holderChart.canv.getContext('2d');
                ctx.strokeStyle = 'gray';
                ctx.lineWidth=1;
                ctx.fillStyle = 'black';
                ctx.font = "12px Arial";
                var infoHt = 18;
                ctx.beginPath();
                ctx.moveTo(1, da.startY+infoHt+0.5);
                ctx.lineTo(dwidth+1, da.startY+infoHt+0.5);
                ctx.fillText("Volume"/*+"("+this.ma5+","+this.ma10+")"*/, 6.5, da.startY+12.5);
                ctx.fillText(H.toFixed(0), dwidth+6.5, da.startY+infoHt+4.5);
                ctx.fillText("0", dwidth+6.5, da.getMaxY()+0.5-4);
                ctx.stroke();

                var D = H-L;
                var Ht = da.height-1-infoHt;

                var currX = sw + Math.floor(kw/2);//内部x坐标
                var maxX = da.getMaxX();
                for (i = beginIdx; i < endIdx; ++i) {
                    var v = Number(klines[i]["volume"]);
                    if (i == 0) {
                        drawStartVolBar(currX, get_y_by_volume(v));
                    } else if (i > 0 && currX + kw < maxX) {
                        var pv = Number(klines[i-1]["volume"]);
                        if (v > pv) {
                            drawPositiveVolBar(currX, get_y_by_volume(v));
                        } else {
                            drawNegativeVolBar(currX, get_y_by_volume(v));
                        }
                    }
                    currX += tw;
                }

                function get_y_by_volume(v) {
                    return Math.floor((H-v)*(Ht-1)/D);
                }

                //注意hY的值<=lY
                function drawPositiveVolBar(x, hY) {
                    strokeVolBar(x, hY, "red");
                }

                function strokeVolBar(x, hY, color) {
                    //console.log("strokeVolBar, hY=" + hY);
                    var pos = da.getPos(x, hY);
                    var ux = pos.x;
                    var uhy = pos.y+1+infoHt;
                    var uly = da.getMaxY();
                    //console.log("uhy="+uhy+", uly="+uly);
                    ctx.strokeStyle = color;
                    ctx.lineWidth=1;
                    if (kw < 3) {
                        ctx.beginPath();
                        ctx.moveTo(ux+0.5, uhy+0.5);
                        ctx.lineTo(ux+0.5, uly+0.5);
                        if (kw > 1) {
                            ctx.moveTo(ux+1.5, uhy+0.5);
                            ctx.lineTo(ux+1.5, uly+0.5);
                        }
                        ctx.stroke();
                    } else {
                        /*console.log("strokeRect: " + (ux-Math.floor(kw/2)+0.5)
                            + ", " + (uhy+0.5)
                            + ", " + (kw-1)
                            + ", " + (uly-uhy));*/
                        ctx.strokeRect(ux-Math.floor(kw/2)+0.5, uhy+0.5, kw-1, uly-uhy);
                    }
                }

                function drawNegativeVolBar(x, hY) {
                    fillVolBar(x, hY, "green");
                }

                function drawStartVolBar(x, hY) {
                    fillVolBar(x, hY, "#54ade3");
                }

                function fillVolBar(x, hY, color) {
                    var pos = da.getPos(x, hY);
                    var ux = pos.x;
                    var uhy = pos.y+1+infoHt;
                    var uly = da.getMaxY();
                    ctx.strokeStyle = color;
                    ctx.lineWidth=1;
                    if (kw < 3) {
                        ctx.beginPath();
                        ctx.moveTo(ux+0.5, uhy+0.5);
                        ctx.lineTo(ux+0.5, uly+0.5);
                        if (kw > 1) {
                            ctx.moveTo(ux+1.5, uhy+0.5);
                            ctx.lineTo(ux+1.5, uly+0.5);
                        }
                        ctx.stroke();
                    } else {
                        ctx.fillStyle = color;
                        ctx.fillRect(ux-Math.floor(kw/2), uhy, kw, uly-uhy+1);
                    }
                }
            };

            function MAIndicator() {
                this.lineColors = ["#323232"/*黑色[0]*/, "#ff00ff"/*明亮粉紫[1]*/, "#65df00"/*亮绿[2]*/,
                    "#800000"/*赭色[3]*/, "#008000"/*暗绿[4]*/, "#b871ff"/*暗紫[5]*/,
                    "#0079d5"/*素蓝[6]*/, "#ffa800"/*类黄浅橙[7]*/, "gray"/*灰色[8]*/];
                this.maSystems = [
                    {"name":"一般均线系统", "maNums":[5, 10, 20, 30, 60, 120, 250], "colorIndex":[0,1,2,3,4,6,7]},
                    {"name":"斐波那契均线系统", "maNums":[5, 13, 21, 34, 55, 89, 144, 233], "colorIndex":[0,1,2,3,4,5,6,7]},
                    {"name":"2条短期均线系统", "maNums":[5, 10],  "colorIndex":[0,1]},
                    {"name":"2条长期均线系统", "maNums":[120, 250],  "colorIndex":[6,7]}
                ];
                //this.maNums = [5, 10, 20, 30, 60, 120, 250];
                //this.maNums = [5, 13, 21, 34, 55, 89, 144, 233];
                //this.maNums = [5, 10];f
                this.isVisible = true;
            }

            MAIndicator.prototype.render = function () {
                if (!this.isVisible) {
                    return;
                }
                var beginIdx = holderChart.beginKBarIndex;
                var endIdx = holderChart.endKBarIndex;
                var lv = holderChart.currKLv;
                var klines = holderChart.indicators["kline"].klines[lv];
                var scl = holderChart.displayScale.getScale();
                var sw = scl['s'];
                var kw = scl['k'];
                var tw = sw + kw;
                var da = holderChart.displayAreas["primary"];
                var dwidth = da.width;
                var Ht = da.height;

                var H = 0;
                var L = Number.MAX_VALUE;
                var i;
                for (i = beginIdx; i < endIdx; ++i) {
                    var h = Number(klines[i].highestprice);
                    var l = Number(klines[i].lowestprice);
                    if (H < h) {
                        H = h;
                    }
                    if (L > l) {
                        L = l;
                    }
                }
                var D = H - L;

                var beginX = holderChart.displayAreas["primary"].startX + sw + Math.floor(kw/2);

                var selIdx = $("#sel-ma-sys")[0].selectedIndex;
                console.log("ma render, selIdx=" + selIdx);
                var maNums = this.maSystems[selIdx].maNums;

                var maxNum = Number.MIN_VALUE;
                var prePositions = [];
                var j;
                for (j = 0; j < maNums.length; ++j) {
                    prePositions[j] = null;
                    if (maNums[j] > maxNum) {
                        maxNum = maNums[j];
                    }
                }

                if (beginIdx - maxNum + 1 < 0 && !klines.leftBoundaryClear) {
                    console.log("ma indicator sending asynchronous kline request.");
                    holderChart.asynchronousRequestKLines("L", function (objLen) {
                        holderChart.render(beginIdx + objLen, endIdx + objLen);
                    });
                    return;
                }

                var i;

                var can = holderChart.canv;
                var ctx = can.getContext('2d');
                for (j = 0; j < maNums.length; ++j) {
                    var num = maNums[j];
                    var sumVal;
                    var currX = beginX;
                    ctx.strokeStyle = this.lineColors[this.maSystems[selIdx]["colorIndex"][j]];
                    ctx.lineWidth = 0.7;
                    ctx.beginPath();
                    for (i = beginIdx; i < endIdx; ++i) {
                        //var currPos;
                        var currPos = null;
                        if (prePositions[j]) {
                            sumVal += Number(Number(klines[i]["closeprice"]));
                            var ap = sumVal / num;
                            currPos = {
                                x:currX,
                                y:holderChart.calcCoordinateY(ap)
                            };
                            ctx.moveTo(prePositions[j].x+0.5, prePositions[j].y+0.5);
                            ctx.lineTo(currPos.x+0.5, currPos.y+0.5);
                            sumVal -= Number(klines[i-num+1]["closeprice"]);
                        } else {
                            if (i - num + 1 >= 0) {
                                sumVal = 0;
                                var k;
                                for (k = i-num+1; k <= i; ++k) {
                                    sumVal += Number(klines[k]["closeprice"]);
                                }
                                var tailVal = Number(klines[i-num+1]["closeprice"]);
                                var ap = sumVal / num;
                                currPos = {
                                    x:currX,
                                    y:holderChart.calcCoordinateY(ap)
                                };
                                sumVal -= tailVal;
                            }
                        }
                        prePositions[j] = currPos;
                        currX += tw;
                    }
                    ctx.stroke();
                }

                /*
                /* klines: 使用闭包变量
                /* j: 计算平均价格的那根K线的索引。例如，ma5计算的是klines[j-4]
                // 到klines[j]的平均数。
                // num: 计算多少天的平均数。例如ma20的num就是20
                */
                function getAveragePrice(j, num, priceName) {
                    var tot = 0;
                    var i;
                    for (i = j-num+1; i <= j; ++i) {
                        var kline = klines[i];
                        if (!kline) {
                            return null;
                        }
                        tot += Number(kline[priceName]);
                    }
                    return tot / num;
                }
            };

            MAIndicator.prototype.switchVisible = function () {
                this.isVisible = !(this.isVisible);
                holderChart.reRender();
            };

            function MACDIndicator() {
                /*
                this.arrEMA = [];
                this.arrDIF = [];
                this.arrDEA = [];
                this.arrMACD = [];
                */

                this.fastM = 12;
                this.slowM = 26;
                this.deaM = 9;
                this.macdM = 2;

                this.fastLineColor = "black";//白线，快线，DIF线
                this.slowLineColor = "blue";//黄线，慢线，DEA线（DIF的EMA均线）
                this.macdUpColor = "red";
                this.macdDownColor = "green";
            }

            MACDIndicator.prototype.render = function () {
                if (holderChart.secondaryIndicatorNames[
                        holderChart.secondaryIndicatorIdx] != "macd") {
                    return;
                }

                var beginIdx = holderChart.beginKBarIndex;
                var endIdx = holderChart.endKBarIndex;
                var lv = holderChart.currKLv;
                var klines = holderChart.indicators["kline"].klines[lv];
                var scl = holderChart.displayScale.getScale();
                var sw = scl['s'];
                var kw = scl['k'];
                var tw = sw + kw;
                var da = holderChart.displayAreas["secondary1"];
                var dwidth = da.width;

                // 首先计算EMA

                var i;

                // 而这又首先要看下显示的beginIdx前面的
                // K线数据够不够多出500根

                if (beginIdx >= 500) {//OK
                    i = beginIdx - 500;
                } else {
                    if (klines.leftBoundaryClear) {
                        //实在是地主家也没余粮呀
                        i = 0;
                    } else {
                        console.log("macd indicator sending asynchronous kline request.");
                        holderChart.asynchronousRequestKLines("L", function (objLen) {
                            holderChart.render(beginIdx + objLen, endIdx + objLen);
                        });
                        return;
                    }
                }

                var beginIii = i;

                var prevFastEMA = klines[i]["closeprice"];
                var prevSlowEMA = klines[i]["closeprice"];
                klines[i]["fastEMA"] = prevFastEMA;
                klines[i]["slowEMA"] = prevSlowEMA;
                for (++i; i < endIdx; ++i) {
                    var ema = (klines[i]["closeprice"] * 2
                        + prevFastEMA * (this.fastM - 1))
                        / (this.fastM + 1);
                    klines[i]["fastEMA"] = ema;
                    prevFastEMA = ema;

                    ema = (klines[i]["closeprice"] * 2
                        + prevSlowEMA * (this.slowM - 1))
                        / (this.slowM + 1);
                    klines[i]["slowEMA"] = ema;
                    prevSlowEMA = ema;
                }

                //DIF
                for (i = beginIii; i < endIdx; ++i) {
                    klines[i]["dif"] = klines[i]["fastEMA"] - klines[i]["slowEMA"];
                    //console.log("calc-ed dif:"+klines[i]["dif"]);
                }

                //DEA
                var prevDEA = klines[beginIii]["dif"];
                for (i = beginIii+1; i < endIdx; ++i) {
                    var dea = (klines[i]["dif"] * 2
                        + prevDEA * (this.deaM - 1))
                        / (this.deaM + 1);
                    klines[i]["dea"] = dea;
                    prevDEA = dea;
                    //console.log("calc-ed dea:"+klines[i]["dea"]);
                }

                //MACD
                for (i = beginIdx; i < endIdx; ++i) {
                    klines[i]["macd"] = (klines[i]["dif"] - klines[i]["dea"]) * this.macdM;
                    //console.log("calc-ed macd:"+klines[i]["macd"]);
                }

                //计算DIF,DEA和MACD中最小和最大值

                var H = 0;
                var L = Number.MAX_VALUE;
                for (i = beginIdx; i < endIdx; ++i) {
                    var dif = Number(klines[i]["dif"]);
                    if (dif > H) {
                        H = dif;
                    }
                    if (dif < L) {
                        L = dif;
                        //console.log("setting L to dif="+L+", i=" + i);
                    }
                    var dea = Number(klines[i]["dea"]);
                    if (dea > H) {
                        H = dea;
                    }
                    if (dea < L) {
                        L = dea;
                        //console.log("setting L to dea="+L+", i=" + i);
                    }
                    var macd = Number(klines[i]["macd"]);
                    if (macd > H) {
                        H = macd;
                    }
                    if (macd < L) {
                        L = macd;
                        //console.log("setting L to macd="+L+", i=" + i);
                    }
                }

                var D = H-L;

                var ctx = holderChart.canv.getContext('2d');
                ctx.strokeStyle = 'gray';
                ctx.lineWidth=1;
                ctx.fillStyle = 'black';
                ctx.font = "12px Arial";
                var infoHt = 18;
                var Ht = da.height-1-infoHt;
                var zeroY = get_y_by_val(0) + 1 + infoHt;
                //console.log("macd, H L D zeroY" + H+", "+L+", "+D+", "+zeroY);
                ctx.beginPath();
                ctx.moveTo(1, da.startY+infoHt+0.5);
                ctx.lineTo(dwidth+1, da.startY+infoHt+0.5);
                ctx.fillText("MACD"/*+"("+this.fastM+","+this.slowM+")"*/, 6.5, da.startY+12.5);
                ctx.fillText(H.toFixed(3), dwidth+6.5, da.startY+infoHt+4.5);
                ctx.fillText("0", dwidth+6.5, da.startY+zeroY+3.5);
                //console.log("L:"+L);
                ctx.fillText(L.toFixed(3), dwidth+6.5, da.getMaxY()+0.5-4);
                ctx.stroke();

                function get_y_by_val(v) {
                    var y = (H-v)*(Ht-1)/D;
                    return Math.floor(y);
                }

                ctx.beginPath();
                ctx.moveTo(1, da.startY + zeroY + 0.5);
                ctx.lineTo(dwidth+1, da.startY + zeroY + 0.5)
                ctx.stroke();

                var currX = sw + Math.floor(kw/2);
                //var maxX = da.getMaxX();
                var prevDIFy;
                var prevDEAy;
                var prevX;
                for (i = beginIdx; i < endIdx; ++i) {
                    var macd = Number(klines[i]["macd"]);
                    var y = get_y_by_val(macd);
                    //console.log("macd:" + macd + ", y:" + y);
                    if (macd < 0) {
                        ctx.strokeStyle = this.macdDownColor;
                    } else if (macd > 0) {
                        ctx.strokeStyle = this.macdUpColor;
                    }
                    ctx.beginPath();
                    ctx.moveTo(currX+da.startX+0.5, da.startY+zeroY);
                    ctx.lineTo(currX+da.startX+0.5, da.startY+y+1+infoHt);
                    ctx.stroke();

                    ctx.lineWidth=0.6;

                    // 快线 DIF线
                    ctx.beginPath();
                    ctx.strokeStyle = this.fastLineColor;
                    if (prevDIFy) {
                        var difY = da.startY + get_y_by_val(klines[i]["dif"]);
                        ctx.moveTo(prevX+da.startX+0.5, prevDIFy+1.5+infoHt);
                        ctx.lineTo(currX+da.startX+0.5, difY+1.5+infoHt);
                        prevDIFy = difY;
                    } else {
                        prevDIFy = da.startY + get_y_by_val(klines[i]["dif"]);
                    }
                    ctx.stroke();

                    // 慢线 DEA线
                    ctx.beginPath();
                    ctx.strokeStyle = this.slowLineColor;
                    if (prevDEAy) {
                        var deaY = da.startY + get_y_by_val(klines[i]["dea"]);
                        ctx.moveTo(prevX+da.startX+0.5, prevDEAy+1.5+infoHt);
                        ctx.lineTo(currX+da.startX+0.5, deaY+1.5+infoHt);
                        prevDEAy = deaY;
                    } else {
                        prevDEAy = da.startY + get_y_by_val(klines[i]["dea"]);
                    }
                    ctx.stroke();

                    prevX = currX;
                    currX += tw;
                }
            };
            
            //--(end)---------------------------
            // Indicators
            //----------------------------------
            
            function DisplayScale() {
                this.currGear = 21;//index on scalesTable
            }
            
            DisplayScale.prototype.scalesTable = [];
            var scalesTable = DisplayScale.prototype.scalesTable;
            // k 是K线占多少个像素，s 是K线之间的空白占多少个像素
            scalesTable[10] = {"k":1, "s":0};
            scalesTable[11] = {"k":1, "s":1};
            scalesTable[12] = {"k":1, "s":2};
            scalesTable[13] = {"k":2, "s":0};
            scalesTable[14] = {"k":2, "s":1};
            scalesTable[15] = {"k":2, "s":2};
            scalesTable[16] = {"k":3, "s":0};
            scalesTable[17] = {"k":3, "s":1};
            scalesTable[18] = {"k":3, "s":2};
            scalesTable[19] = {"k":4, "s":2};
            scalesTable[20] = {"k":5, "s":2};
            scalesTable[21] = {"k":7, "s":3};
            scalesTable[22] = {"k":9, "s":4};
            scalesTable[23] = {"k":11, "s":4};
            scalesTable[24] = {"k":13, "s":5};
            scalesTable[25] = {"k":15, "s":5};
            scalesTable[26] = {"k":17, "s":5};
            scalesTable[27] = {"k":19, "s":6};
            scalesTable[28] = {"k":19, "s":7};
            scalesTable[29] = {"k":21, "s":6};
            scalesTable[30] = {"k":21, "s":7};
            
            DisplayScale.prototype.getScale = function () {
                return this.scalesTable[this.currGear];
            };

            DisplayScale.prototype.fastZoomIn = function () {
                //
            }

            DisplayScale.prototype.fastZoomOut = function () {
                //
            }
            
            DisplayScale.prototype.zoomIn = function () {
                if (this.scalesTable.hasOwnProperty((this.currGear+1).toString())) {
                    ++(this.currGear);
                    console.log("zoom in ok, currGear=" + this.currGear);
                    console.log(JSON.stringify(this.scalesTable[this.currGear]));
                    return true;
                } else {
                    console.log("zoom in rejected, currGear=" + this.currGear);
                    console.log(JSON.stringify(this.scalesTable[this.currGear]));
                    return false;
                }
            };
            
            DisplayScale.prototype.zoomOut = function () {
                if (this.scalesTable.hasOwnProperty((this.currGear-1).toString())) {
                    --(this.currGear);
                    console.log("zoom out ok, currGear=" + this.currGear);
                    console.log(JSON.stringify(this.scalesTable[this.currGear]));
                    return true;
                } else {
                    console.log("zoom out rejected, currGear=" + this.currGear);
                    console.log(JSON.stringify(this.scalesTable[this.currGear]));
                    return false;
                }
            };

            function KeyRepeater() {
                //console.log("KeyRepeater constructor");
                this.intervalVal = 120;
                this.repeatLimen = 399;
                this.keys = {
                    "moveLeft":[false, 0],
                    "moveRight":[false, 0]
                };
            }

            KeyRepeater.prototype.onRepeat = function () {
                for (var k in this.keys) {
                    var abstractKeyObj = this.keys[k];
                    if (abstractKeyObj[0] == true) {
                        //console.log("abs key=" + k + ", is true");
                        ++(abstractKeyObj[1]);
                        if (abstractKeyObj[1] * this.intervalVal > this.repeatLimen) {
                            //console.log("reach limen!!");
                            if (abstractKeyObj.length > 2 && typeof(abstractKeyObj[2])=="function") {
                                //console.log("firing!");
                                abstractKeyObj[2]();
                            }
                        }
                    }
                }
            };

            KeyRepeater.prototype.setHook = function (keyName, callback) {
                this.keys[keyName][2] = callback;
            };

            // param 'count' is not necessarily needed
            KeyRepeater.prototype.turnOnKey = function (keyName, count) {
                if (!count || count < 0) {
                    count = 0;
                }
                if (this.keys.hasOwnProperty(keyName)) {
                    var abstractKeyObj = this.keys[keyName];
                    abstractKeyObj[0] = true;
                    abstractKeyObj[1] = count;
                    if (abstractKeyObj.length > 2 && typeof(abstractKeyObj[2])=="function") {
                        // this is a immediate call, and next call
                        // should happen when this.repeatLimen is exceeded
                        abstractKeyObj[2]();
                    }
                }
            };

            KeyRepeater.prototype.turnOffKey = function (keyName) {
                if (this.keys.hasOwnProperty(keyName)) {
                    this.keys[keyName][0] = false;
                    this.keys[keyName][1] = 0;
                }
            };

            KeyRepeater.prototype.init = function (chart) {
                this.setHook("moveLeft", function(){chart.moveLeft();});
                this.setHook("moveRight", function(){chart.moveRight();});

                var that = this;
                // handle can be used in "clearInterval(handle)"
                var handle = setInterval(function(){that.onRepeat();}, this.intervalVal);
            };

            KeyRepeater.prototype.turnOffAllKeys = function () {
                for (k in this.keys) {
                    this.keys[k][0] = false;
                    this.keys[k][1] = 0;
                }
            };

            function DisplayArea(name, startX, startY, width, height) {
                this.name = name;
                //(startX, startY)是左上角的点
                this.startX = startX;
                this.startY = startY;
                //显示区域的右下角的点是(startX+width-1, startY+height-1)
                this.width = width;
                this.height = height;
            }

            //通过内部的inner_pos(x,y)获得外部的pos(x,y)
            DisplayArea.prototype.getPos = function (x,y) {
                return {x:this.startX+x, y:this.startY+y};
            };

            //获得最大可用的外部x坐标
            DisplayArea.prototype.getMaxX = function () {
                return this.startX + this.width - 1;
            };

            //获得最大可用的外部y坐标
            DisplayArea.prototype.getMaxY = function () {
                return this.startY + this.height - 1;
            };
        }
        
        Chart.prototype.init = function(canv, settings) {
            this.canv = canv;
            if (settings != null) {
                /* ================================================
                 * 注意：现在还没有写代码把chart的width和height变成
                 * canvas的offsetWidth和offsetHeight!!
                 ================================================*/
                if (settings.hasOwnProperty("width")) {
                    this.width = settings.width;
                }
                if (settings.hasOwnProperty("height")) {
                    this.height = settings.height;
                }
            }

            //==================
            //====外部组件=======
            //==================

            this.indicators["penline"] = new stockplayer.penline.PenLineIndicator();
            this.indicators["segment"] = new stockplayer.segment.SegmentIndicator();

            //==================

            this.keyRepeater.init(this);

            this.adjustDisplayAreas();
            
            var ctx = canv.getContext('2d');
            ctx.strokeStyle = 'gray';
            ctx.lineWidth = 1;
            // 由于HTML的canvas设计如此，为了画出真正的1像素宽的直线，
            // 需要画在对齐于0.5的坐标上。
            console.log(canv.offsetWidth + " x " + canv.offsetHeight);
            ctx.strokeRect(0.5, 0.5, canv.offsetWidth-1, canv.offsetHeight-1);

            var i;
            for (i = 1; i <= 9; ++i) {
                var id = "#ma_num_input" + i;
                $(id).css("width", "24px");
                $(id).prev("span").css("position", "relative");
                $(id).prev("span").css("top", "1px");
                if (i > 1) {
                    $(id).prev("span").css("margin-left", "2px");
                }
                $(id).spinner({max:999,min:0,stop:function (event, ui) {
                    //console.log(event);
                    //console.log(ui);
                    console.log("「(spin)stop」 event, id: " + event.target.id
                            + ", value: " + event.target.value);
                },
                spin:function (event, ui) {
                        //console.log(event);
                        //console.log(ui);
                        console.log("「spin」 event, id: " + event.target.id
                            + ", value: " + event.target.value);
                },
                change:function(event,ui){
                    //console.log(event);
                    console.log("「change」 event, id: " + event.target.id
                            + ", value: " + event.target.value);
                }});
                $(id).parent("span").parent("span").css("display", "none");
            }


            //$("#sel-ma-sys").selectmenu();
            var that = this;
            var sel = $("#sel-ma-sys");
            sel.change(function(){
                var idx = sel[0].selectedIndex;
                console.log("sel-ma-sys: [" + idx + "] " + sel.val());
                if (that.autoSelMA) {
                    that.autoSelMA = false;
                    console.log("autoSelMA, gonna return.");
                    return;
                }
                that.setMASystemIndex(idx);
                that.reRender();
            });

            this.setMASystemIndex(0);
        };
        
        // reset settings? maybe for later uses
        Chart.prototype.setChartData = function(settings) {
            //todo (later)
        };
        
        Chart.prototype.setup = function (lv, klines) {
            this.indicators["kline"].setup(lv, klines);
        };

        Chart.prototype.adjustDisplayAreas = function () {
            //if mode == single assistant indicator view
            var da = this.displayAreas["primary"];
            da.startX = 1;
            da.startY = 1;
            da.width = this.splitLines.vs.x-1;
            da.height = this.splitLines.hs1.y-1;
            var da2 = this.displayAreas["secondary1"];
            da2.startX = 1;
            da2.startY = this.splitLines.hs1.y+1;
            da2.width = da.width;
            da2.height = this.splitLines.hs2.y-this.splitLines.hs1.y-1;
            var da3 = this.displayAreas["num1"];
            da3.startX = this.splitLines.vs.x+1;
            da3.startY = 1;
            da3.width = this.width-this.splitLines.vs.x-2;
            da3.height = da.height;
            da = this.displayAreas["num2"];
            da.startX = this.splitLines.vs.x+1;
            da.startY = this.splitLines.hs1.y+1;
            da.width = da3.width;
            da.height = da2.height;
        };

        Chart.prototype.getDisplayKBarNum = function () {
            var scl = this.displayScale.getScale();
            var sw = scl['s'];
            var kw = scl['k'];
            var tw = sw + kw;
            //var dwidth = this.getKLinesDisplayWidth();
            //var dispKBarNum = Math.floor( (dwidth-sw) / tw );
            var dispKBarNum = 0;
            var currX = this.displayAreas["primary"].startX + sw + Math.floor(kw/2);
            var maxX = this.displayAreas["primary"].getMaxX();
            while (currX + Math.ceil(kw/2) + 1 < maxX) {
                currX += tw;
                ++dispKBarNum;
            }
            return dispKBarNum;
        };
        
        Chart.prototype.renderFocus = function (focusDatetime) {
            /*
            * 首先，要找到离focusDatetime这个时间最近的那个K线的index
            */
            var lv = this.currKLv;
            //ASSERT
            if ( ! this.indicators["kline"].klines.hasOwnProperty(lv) ) {
                this.alert("renderFocus: 没有这个级别的K线数据，lv=" + lv + "focusDatetime=" + focusDatetime);
                return;
            }
            
            var fd = focusDatetime;
            
            var klines = this.indicators["kline"].klines[lv];
            var prev_ad = Number.MAX_VALUE;//ad for abs diff
            var i;
            for (i = 0; i < klines.length; ++i) {
                //ad for abs diff
                var dn = Date.parse(klines[i].ktime);
                if (isNaN(dn)) {
                        var kt = klines[i].ktime.replace(/-/g, '/');
                        dn = Date.parse(kt);
                }
                var ad = Math.abs(dn - fd);
                if (ad < prev_ad) {
                    prev_ad = ad;
                } else {
                    //console.log("abs diff search breaking, i="+i);
                    break;
                }
            }
            //注意要减1之后才是最近的那个
            var idx = i-1;
            if (idx < 0) {
                idx = 0;
            }

            console.log("render focus found nearest index: " + idx);
            
            var scl = this.displayScale.getScale();
            var sw = scl['s'];
            var kw = scl['k'];
            var tw = sw + kw;
            
            //how many k lines can be displayed on left side of focused k line, if there has enough space of half the width of canvas
            var knum = Math.floor( (this.width/2 - 1 - sw) / tw );
            //console.log("knum: " + knum);
            
            //begin(left most) kbar's index
            idx = i - knum;
            if (idx < 0) {
                idx = 0;
            }
            
            var dwidth = this.getKLinesDisplayWidth();
            //console.log("getKLinesDisplayWidth:" + dwidth);
            var dispKBarNum = this.getDisplayKBarNum();
            var beginIdx = idx;
            var endIdx = beginIdx + dispKBarNum;//excluded
            this.render(beginIdx, endIdx);
        };

        Chart.prototype.renderEndIdx = function () {
            var dispKBarNum = this.getDisplayKBarNum();
            var endIdx = this.endKBarIndex;
            this.render(endIdx-dispKBarNum, endIdx);
        };

        /*
         * 此Center是display的center。与renderFocus不同，renderFocus关注的是根据某个datetime，
         * 把距离这个datetime最近的那根K线居中显示，是以datetime为出发点；本函数是以beginIdx和
         * endIdx的中间的index为出发点
         */
        Chart.prototype.renderCenter = function () {
            var dispKBarNum = this.getDisplayKBarNum();
            var centerIdx = Math.floor((this.beginKBarIndex + this.endKBarIndex) / 2);
            var beginIdx = Math.floor(centerIdx - dispKBarNum/2);
            this.render(beginIdx, beginIdx+dispKBarNum);
        };

        Chart.prototype.asynchronousRequestKLines = function (mode, tailFunc) {
            var klines = this.indicators['kline'].klines[this.currKLv];
            var that = this;
            if (mode[0].toUpperCase() == "L") {
                var url = "kline.php?s=" + this.currStockCode
                    + "&l=" + this.currKLv
                    + "&d=" + stockplayer.util.anti_standarize_datetime(klines[0]["ktime"])
                    + "&n=" + this.nokior
                    + "&m=l";
                $.get(url, function (data, textStatus, jqXHR) {
                    var obj = JSON.parse(data);
                    console.log("on kline.php left mode response");
                    console.log("obj.klines.length: " + obj.klines.length);
                    var oldLeft = klines.leftBoundaryClear;
                    var oldRight = klines.rightBoundaryClear;
                    klines = obj.klines.concat(klines);
                    console.log("after concatenating, klines.length is: " + klines.length);
                    console.log("obj.klines.length: " + obj.klines.length);
                    klines.leftBoundaryClear = oldLeft;
                    klines.rightBoundaryClear = oldRight;
                    if (obj.klines.length < that.nokior) {
                        console.log("setting leftBoundaryClear to true");
                        klines.leftBoundaryClear = true;
                    }
                    // 注意！！上面的concat实际上重新生成了klines，
                    // 所以需要手动地把原来所指的变量也改了才行
                    that.indicators['kline'].klines[that.currKLv] = klines;

                    //that.render(beginIdx + obj.klines.length, endIdx + obj.klines.length);
                    if (tailFunc) {
                        tailFunc(obj.klines.length);
                    }
                });
            } else if (mode[0].toUpperCase() == "R") {
                var url = "kline.php?s=" + this.currStockCode
                    + "&l=" + this.currKLv
                    + "&d=" + stockplayer.util.anti_standarize_datetime(klines[klines.length-1]["ktime"])
                    + "&n=" + this.nokior
                    + "&m=r";
                $.get(url, function (data, textStatus, jqXHR) {
                    var obj = JSON.parse(data);
                    console.log("on kline.php right mode response");
                    console.log("obj.klines.length: " + obj.klines.length);
                    var oldLeft = klines.leftBoundaryClear;
                    var oldRight = klines.rightBoundaryClear;
                    klines = klines.concat(obj.klines);
                    console.log("after concatenating, klines.length is: " + klines.length);
                    console.log("obj.klines.length: " + obj.klines.length);
                    klines.leftBoundaryClear = oldLeft;
                    klines.rightBoundaryClear = oldRight;
                    if (obj.klines.length < that.nokior) {
                        console.log("setting rightBoundaryClear to true");
                        klines.rightBoundaryClear = true;
                    }
                    that.indicators['kline'].klines[that.currKLv] = klines;

                    //that.render(beginIdx, endIdx);
                    if (tailFunc) {
                        tailFunc(obj.klines.length);
                    }
                });
            }
            // else fail
        };

        // 要保证beginIdx和endIdx都是存在的
        Chart.prototype.renderAutoScale = function (beginIdx, endIdx) {
            var num = endIdx - beginIdx + 1;
            var dnum = this.getDisplayKBarNum();
            while (dnum > num) {
                this.displayScale.zoomIn();
                var lastD = dnum;
                dnum = this.getDisplayKBarNum();
                if (dnum==lastD) {
                    break;
                }
            }
            while (dnum <= num) {
                this.displayScale.zoomOut();
                var lastD = dnum;
                dnum = this.getDisplayKBarNum();
                if (dnum==lastD) {
                    break;
                }
            }
            this.endKBarIndex = endIdx + 1 + Math.floor((dnum - num) / 2);
            this.renderEndIdx();
        };

        //num仅用来计算尺寸用
        Chart.prototype.renderCenterAutoScale = function (beginIdx, endIdx) {
            var num = endIdx - beginIdx;
            console.log("in renderCenterAutoScale, beginIdx=" + beginIdx + ", num=" + num);
            var dnum = this.getDisplayKBarNum();
            while (dnum > num) {
                this.displayScale.zoomIn();
                var lastD = dnum;
                dnum = this.getDisplayKBarNum();
                if (dnum == lastD) {
                    break;
                }
            }
            while (dnum < num) {
                this.displayScale.zoomOut();
                var lastD = dnum;
                dnum = this.getDisplayKBarNum();
                if (dnum == lastD) {
                    break;
                }
            }
            this.beginKBarIndex = beginIdx;
            this.endKBarIndex = endIdx;
            this.renderCenter();
        };
        
        Chart.prototype.render = function (beginIdx, endIdx) {
            console.log("Chart.prototype.render, beginIdx=" + beginIdx + ", endIdx=" + endIdx);
            if (this.currStockCode == null) {
                console.log("error: in Chart.render, this.currStockCode is null");
                return;
            }
            var klines = this.indicators['kline'].klines[this.currKLv];
            if (beginIdx < 0) {
                //首先要检查是否已经确知了左边界
                if (klines.leftBoundaryClear == true) {//如果确知的左边界已经存在，就不需要麻烦去请求数据了
                    //而是做相应的提示
                    //todo
                    //tmp
                    this.alert("leftBoundaryClear is true!");

                    //并直接使用beginIdx为0调用自己一次，从而直接强制消除左索引越界
                    var dispKBarNum = this.getDisplayKBarNum();
                    if (dispKBarNum > klines.length) {
                        dispKBarNum = klines.length;
                    }
                    this.render(0, dispKBarNum);
                } else {
                    var that = this;
                    this.asynchronousRequestKLines('l', function (retKCount) {
                        that.render(beginIdx + retKCount, endIdx + retKCount);
                    });
                }
            } else if (endIdx > klines.length) {
                if (klines.rightBoundaryClear == true) {
                    //todo
                    //tmp
                    this.alert("rightBoundaryClear is true!");

                    var dispKBarNum = this.getDisplayKBarNum();
                    var newBegin = klines.length-dispKBarNum;
                    if (newBegin < 0) {
                        newBegin = 0;
                    }
                    this.render(newBegin, klines.length);
                } else {
                    var that = this;
                    this.asynchronousRequestKLines('r', function (retKCount) {
                        that.render(beginIdx, endIdx);
                    });
                }
            } else {
                this.doRender(beginIdx, endIdx);
            }
        };

        Chart.prototype.renderSplitLines = function () {
            var ctx = this.canv.getContext('2d');
            ctx.strokeStyle = 'gray';
            ctx.lineWidth = 1;
            ctx.beginPath();
            // if single assistant indicator view
            var x = this.splitLines.vs.x+0.5;
            ctx.moveTo(x, 1.5);
            ctx.lineTo(x, 1.5+this.splitLines.vs.height);
            var y = this.splitLines.hs1.y+0.5;
            ctx.moveTo(1.5, y);
            ctx.lineTo(1.5+this.splitLines.hs1.width, y);
            y = this.splitLines.hs2.y+0.5;
            ctx.moveTo(1.5, y);
            ctx.lineTo(1.5+this.splitLines.hs2.width, y);
            ctx.stroke();
        };

        Chart.prototype.reRender = function () {
            this.render(this.beginKBarIndex, this.endKBarIndex);
        };

        Chart.prototype.doRender = function (beginIdx, endIdx) {
            console.log("Char do render: lv=" + this.currKLv
                        + ", [" + beginIdx + "]-[" + (endIdx-1) + "], "
                        + this.indicators['kline'].klines[this.currKLv].length);
            this.clearContent();
            this.adjustDisplayAreas();
            this.renderSplitLines();
            this.beginKBarIndex = beginIdx;
            this.endKBarIndex = endIdx;//notice that the k bar at end index is excluded when rendering
            this.prepareCoordinateCalc();
            this.indicators["kline"].render();
            this.indicators["vol"].render();
            this.indicators["ma"].render();
            this.indicators["macd"].render();
            if (this.currKLv == '1m') {
                this.indicators["penline"].render();
                this.indicators["segment"].render();
            }
            this.savedImg = this.canv.getContext('2d').getImageData(
                0,0,this.canv.offsetWidth, this.canv.offsetHeight);
        };

        Chart.prototype.moveLeft = function () {
            if (this.currStockCode == null) {
                return;
            }
            var dispKBarNum = this.getDisplayKBarNum();
            var indexNum = Math.floor(dispKBarNum * 0.2);
            var beginIdx = this.beginKBarIndex - indexNum;
            var endIdx = beginIdx + dispKBarNum;
            var klines = this.indicators['kline'].klines[this.currKLv];
            if (beginIdx < 0 && klines.leftBoundaryClear) {
                console.log("moveLeft, setting beginIdx to 0 because leftBoundaryClear");
                beginIdx = 0;
                if (endIdx < dispKBarNum) {
                    endIdx = dispKBarNum;
                }
            }
            if (endIdx > klines.length && klines.rightBoundaryClear) {
                console.log("moveLeft, setting endIdx to klines.length because rightBoundaryClear");
                endIdx = klines.length;
                if (beginIdx > klines.length - dispKBarNum + 1) {
                    beginIdx = klines.length - dispKBarNum + 1;
                }
            }
            this.render(beginIdx, endIdx);
        };

        Chart.prototype.moveRight = function () {
            if (this.currStockCode == null) {
                return;
            }
            var dispKBarNum = this.getDisplayKBarNum();
            var indexNum = Math.floor(dispKBarNum * 0.2);
            var endIdx = this.endKBarIndex + indexNum;
            var beginIdx = endIdx - dispKBarNum;
            var klines = this.indicators['kline'].klines[this.currKLv];
            if (beginIdx < 0 && klines.leftBoundaryClear) {
                console.log("moveRight, setting beginIdx to 0 because leftBoundaryClear");
                beginIdx = 0;
                if (endIdx < dispKBarNum) {
                    endIdx = dispKBarNum;
                }
            }
            if (endIdx > klines.length && klines.rightBoundaryClear) {
                console.log("moveRight, setting endIdx to klines.length because rightBoundaryClear");
                endIdx = klines.length;
                if (beginIdx > klines.length - dispKBarNum + 1) {
                    beginIdx = klines.length - dispKBarNum + 1;
                }
            }
            this.render(beginIdx, endIdx);
        };

        Chart.prototype.switchHigherKLevel = function () {
            var currKLvIdx = null;
            var i;
            for (i = 0; i < this.fixedKLevelList.length; ++i) {
                if (this.currKLv == this.fixedKLevelList[i]) {
                    currKLvIdx = i;
                    break;
                }
            }
            if (typeof(currKLvIdx) == "number") {
                if (currKLvIdx >= this.fixedKLevelList.length-1) {
                    // do nothing
                } else {
                    var klines = this.indicators["kline"].klines[this.currKLv];
                    var dtBegin = klines[this.beginKBarIndex]['ktime'];
                    var dtEnd = klines[this.endKBarIndex]['ktime'];

                    //check if exists higher level kline data
                    if (this.indicators["kline"].klines.hasOwnProperty(this.fixedKLevelList[currKLvIdx+1])) {
                        var kll = this.indicators["kline"].klines[this.fixedKLevelList[currKLvIdx+1]];
                        var beginIdx = stockplayer.util.checkContainKTime(kll, dtBegin);
                        var endIdx = stockplayer.util.checkContainKTime(kll, dtEnd);
                        if (typeof(beginIdx)=="number"
                            && typeof(endIdx)=="number")
                        {
                            this.currKLv = this.fixedKLevelList[currKLvIdx+1];
                            $("#txtKLevel").text(stockplayer.util.getLevelName(this.currKLv));
                            var num = endIdx - beginIdx;
                            this.renderCenterAutoScale(beginIdx, endIdx);
                            return;
                        }
                    }

                    var midIdx = Math.floor((this.endKBarIndex + this.beginKBarIndex) / 2);
                    var dtt = stockplayer.util.anti_standarize_datetime(klines[midIdx]['ktime']);
                    var url = "kline.php?s=" + this.currStockCode
                        + "&l=" + this.fixedKLevelList[currKLvIdx+1]
                        + "&d=" + dtt
                        + "&n=" + stockplayer.chart.nokior
                        + "&m=f";
                    var that = this;
                    $.get(url, function (data, textStatus, jqXHR) {
                        var obj = JSON.parse(data);
                        console.log("obj.klines.length:" + obj.klines.length);
                        if (obj.klines.length==0) {
                            that.alert("没有返回任何K线记录");
                            return;
                        }
                        that.currStockCode = obj.s;
                        that.currStockName = obj.sname;
                        $("#txtStockCode").text(that.currStockCode);
                        $("#txtStockName").text(that.currStockName);
                        $("#txtKLevel").text(stockplayer.util.getLevelName(obj.l));
                        that.setup(obj.l, obj.klines);
                        that.currKLv = obj.l;
                        var klines = that.indicators["kline"].klines[that.currKLv];
                        var beginIdx = stockplayer.util.checkContainKTime(klines, dtBegin);
                        var endIdx = stockplayer.util.checkContainKTime(klines, dtEnd);
                        that.renderCenterAutoScale(beginIdx, endIdx);
                        that.canv.focus();
                    });
                }
            } else {
                this.alert("ERROR: switchHigherKLevel could not find currLv index!");
            }
        };

        //switchLowerKLevel
        Chart.prototype.switchLowerKLevel = function () {
            var currKLvIdx = null;
            var i;
            for (i = 0; i < this.fixedKLevelList.length; ++i) {
                if (this.currKLv == this.fixedKLevelList[i]) {
                    currKLvIdx = i;
                    break;
                }
            }
            if (typeof(currKLvIdx) == "number") {
                if (currKLvIdx == 0) {
                    // do nothing
                } else {
                    var klines = this.indicators["kline"].klines[this.currKLv];
                    var dtBegin = klines[this.beginKBarIndex]['ktime'];
                    var dtEnd = klines[this.endKBarIndex]['ktime'];

                    //check if exists lower level kline data
                    if (this.indicators["kline"].klines.hasOwnProperty(this.fixedKLevelList[currKLvIdx-1])) {
                        var kll = this.indicators["kline"].klines[this.fixedKLevelList[currKLvIdx-1]];
                        var beginIdx = stockplayer.util.checkContainKTime(kll, dtBegin);
                        var endIdx = stockplayer.util.checkContainKTime(kll, dtEnd);
                        if (typeof(beginIdx)=="number"
                            && typeof(endIdx)=="number")
                        {
                            this.currKLv = this.fixedKLevelList[currKLvIdx-1];
                            $("#txtKLevel").text(stockplayer.util.getLevelName(this.currKLv));
                            this.renderCenterAutoScale(beginIdx, endIdx);
                            return;
                        }
                    }

                    var midIdx = Math.floor((this.endKBarIndex + this.beginKBarIndex) / 2);
                    var dtt = stockplayer.util.anti_standarize_datetime(klines[midIdx]['ktime']);
                    var url = "kline.php?s=" + this.currStockCode
                        + "&l=" + this.fixedKLevelList[currKLvIdx-1]
                        + "&d=" + dtt
                        + "&n=" + stockplayer.chart.nokior
                        + "&m=f";
                    var that = this;
                    $.get(url, function (data, textStatus, jqXHR) {
                        var obj = JSON.parse(data);
                        console.log("obj.klines.length:" + obj.klines.length);
                        if (obj.klines.length==0) {
                            that.alert("没有返回任何K线记录");
                            return;
                        }
                        that.currStockCode = obj.s;
                        that.currStockName = obj["sname"];
                        $("#txtStockCode").text(that.currStockCode);
                        $("#txtStockName").text(that.currStockName);
                        $("#txtKLevel").text(stockplayer.util.getLevelName(obj.l));
                        that.setup(obj.l, obj.klines);
                        that.currKLv = obj.l;
                        var klines = that.indicators["kline"].klines[that.currKLv];
                        var beginIdx = stockplayer.util.checkContainKTime(klines, dtBegin);
                        var endIdx = stockplayer.util.checkContainKTime(klines, dtEnd);
                        that.renderCenterAutoScale(beginIdx, endIdx);
                        that.canv.focus();
                    });
                }
            } else {
                this.alert("ERROR: switchLowerKLevel could not find currLv index!");
            }
        };

        Chart.prototype.prevMASystem = function () {
            var sel = $("#sel-ma-sys");
            var idx = sel[0].selectedIndex - 1;
            if (idx < 0) {
                idx = this.indicators['ma'].maSystems.length - 1;
            }
            this.setMASystemIndex(idx);
            this.reRender();
        };

        Chart.prototype.nextMASystem = function () {
            var sel = $("#sel-ma-sys");
            var idx = sel[0].selectedIndex + 1;
            if (idx >= this.indicators['ma'].maSystems.length) {
                idx = 0;
            }
            this.setMASystemIndex(idx);
            this.reRender();
        };

        Chart.prototype.setMASystemIndex = function (index) {
            var maIndicator = this.indicators['ma'];
            var sysCount = maIndicator.maSystems.length;
            var i;
            for (i = 0; i < sysCount; ++i) {
                //$("#sel-ma-sys").children("option").eq(i).attr("selected", false);
            }
            //$("#sel-ma-sys").children("option").attr("selected", false);
            //$("#sel-ma-sys").children("option").eq(index).attr("selected", true);
            $("#sel-ma-sys")[0].selectedIndex = index;

            for (i = 1; i <= 9; ++i) {
                var id = "#ma_num_input" + i;
                $(id).parent("span").parent("span").css("display", "none");
            }

            var maNums = maIndicator.maSystems[index].maNums;
            for (i = 0; i < maNums.length; ++i) {
                var id = "#ma_num_input" + (i+1);
                $(id).spinner("value", maNums[i]);
                $(id).css("color", maIndicator.lineColors[maIndicator.maSystems[index]["colorIndex"][i]]);
                $(id).parent("span").prev("span").css("color",
                    maIndicator.lineColors[maIndicator.maSystems[index]["colorIndex"][i]]);
                $(id).parent("span").parent("span").css("display", "inline");
            }
        };

        Chart.prototype.switchSecondaryIndicator = function () {
            ++(this.secondaryIndicatorIdx);
            if (this.secondaryIndicatorIdx >= this.secondaryIndicatorNames.length) {
                this.secondaryIndicatorIdx = 0;
            }
            this.reRender();
        };
        
        //K bar Display Width, i.e. the width that can be used for displaying k bar
        Chart.prototype.getKLinesDisplayWidth = function () {
            //return this.width - 2 - this.priceWidth;
            return this.displayAreas["primary"].width;
        };

        Chart.prototype.removeSelectedArea = function () {
            this.selAreaBeginIdx = null;
            this.selAreaEndIdx = null;
            this.reRender();
        };
        
        Chart.prototype.clearContent = function () {
            var dwidth = this.getKLinesDisplayWidth();
            var can = this.canv;
            var ctx = can.getContext('2d');
            //ctx.clearRect(1,1,dwidth,can.offsetHeight-2);
            //ctx.clearRect(dwidth+2,1,this.priceWidth-1,can.offsetHeight-2);

            // 从结果来看是这样的，即clearRect不需要对齐到0.5
            ctx.clearRect(1, 1, can.offsetWidth-2, can.offsetHeight-2);
        };

        // 在每次绘制之前，先计算好当前设置下的计算参数
        Chart.prototype.prepareCoordinateCalc = function() {

            // todo: 100%
            // todo: offset
            // todo: locked

            var Ht = this.displayAreas["num1"].height;

            var klines = this.indicators["kline"].klines[this.currKLv];

            var H = 0;
            var L = Number.MAX_VALUE;
            var i;
            for (i = this.beginKBarIndex; i < this.endKBarIndex; ++i) {
                var h = Number(klines[i].highestprice);
                var l = Number(klines[i].lowestprice);
                if (H < h) {
                    H = h;
                }
                if (L > l) {
                    L = l;
                }
            }
            var D = H - L;//最大价差

            this.HPriceYCoord = H;
            this.LPriceYCoord = L;
            this.DPriceYCoord = D;
            this.coePriceYCoord = Ht/D; // coe for coefficient
        };

        // 通过idx计算出它的x坐标（K线的影线的横坐标）
        Chart.prototype.calcCoordinateX = function(idx) {
            var scl = this.displayScale.getScale();
            var sw = scl['s'];
            var kw = scl['k'];
            var tw = sw + kw;
            var beginX = this.displayAreas["primary"].startX + sw + Math.floor(kw/2);
            var beginIdx = this.beginKBarIndex;
            var dIdx = idx - beginIdx;
            return beginX + dIdx * tw;
        };

        // 通过price计算出它的y坐标
        Chart.prototype.calcCoordinateY = function(price) {
            return Math.floor((this.HPriceYCoord-price) * this.coePriceYCoord) + 1;
        };

        //放大（放大K线，“缩小”时间范围）的默认模式，右对齐
        Chart.prototype.zoomIn = function () {
            if (this.currStockCode == null) {
                return;
            }
            var displayScale = this.displayScale;
            if (displayScale.zoomIn()) {
                this.renderEndIdx();
            } else {
                this.alert("已经放大到支持的最大显示比例");
            }
        };

        //缩小（缩小K线，“放大”时间范围）的默认模式，居中对齐
        Chart.prototype.zoomOut = function () {
            if (this.currStockCode == null) {
                return;
            }
            var displayScale = this.displayScale;
            if (displayScale.zoomOut()) {
                this.renderCenter();
            } else {
                this.alert("已经缩小到支持的最小显示比例");
            }
        };

        Chart.prototype.getPointOnCanvas = function (canvas, x, y) {
            var bbox =canvas.getBoundingClientRect();
            return {x: Math.floor(x - bbox.left * (canvas.width / bbox.width)),
                y: Math.floor(y - bbox.top * (canvas.height / bbox.height))};
        };

        Chart.prototype.onmousemove = function (e) {
            var getPointOnCanvas = this.getPointOnCanvas;
            var pos = getPointOnCanvas(e.target, e.pageX, e.pageY);
            //var info = pos.x.toFixed(1) + "," + pos.y.toFixed(1) + "&nbsp;&nbsp;";
            var info = pos.x + "," + pos.y + "&nbsp;&nbsp;";

            var scl = this.displayScale.getScale();
            var sw = scl['s'];
            var kw = scl['k'];
            var tw = sw + kw;
            var a = (pos.x-1-sw)%tw;
            var b = Math.floor( (pos.x-1-sw)/tw );
            var isInKBar = false;
            if (a < kw && a >= 0 && b >=0) {
                info += "(K)&nbsp;";
                isInKBar = true;
            } else {
                info += "(NK)&nbsp;";
                isInKBar = false;
            }
            info += "a=" + a + ",&nbsp;b=" + b;

            //c是鼠标最附近的那个K线的（加起始index之前的）index
            var c = b;
            if (a >= (kw+sw/2)) {
                c++;
            }
            info += ",&nbsp;c=" + c;

            var dispBeginIdx = this.beginKBarIndex;
            var kidx = c + dispBeginIdx;

            var klinesObj = this.indicators["kline"].klines;

            if (/*isInKBar && */
                kidx < this.endKBarIndex &&
                    klinesObj.hasOwnProperty(this.currKLv))
            {
                var ctx = this.canv.getContext('2d');
                ctx.putImageData(this.savedImg, 0, 0);
                ctx.strokeStyle = "#888888";
                ctx.lineWidth = 1;
                var ld = ctx.getLineDash();
                ctx.setLineDash([5, 7]);//[实像素,虚像素]
                ctx.beginPath();
                var xcoor = pos.x-a+kw/2;
                if (kw%2==0) {
                    xcoor += 0.5;
                }
                ctx.moveTo(xcoor, 1);
                ctx.lineTo(xcoor, this.canv.offsetHeight-1);
                ctx.moveTo(1, pos.y+0.5);
                ctx.lineTo(this.canv.offsetWidth-1, pos.y+0.5);
                ctx.stroke();
                ctx.setLineDash([]);

                var klines = klinesObj[this.currKLv];
                var kRecord = klines[kidx];
                if (kRecord) {
                    info += " | H=" + kRecord['highestprice'] + ", L=" + kRecord['lowestprice'] + ", O=" + kRecord['openprice'] + ", C=" + kRecord['closeprice'];
                    info += ", V=" + kRecord['volume'] + ", T=" + kRecord['turnover'];
                    if (kRecord["macd"]) {
                        info += " DIF=" + kRecord['dif'] + ", DEA=" + kRecord['dea']
                            + ", MACD=" + kRecord["macd"];
                    }
                    info += " | " + kRecord['ktime'];

                    $("#inf_datetime").text(kRecord['ktime']);
                    $("#inf_openprice").text("开盘价：" + kRecord['openprice']);
                    $("#inf_closeprice").text("收盘价：" + kRecord['closeprice']);
                    $("#inf_highestprice").text("最高价：" + kRecord['highestprice']);
                    $("#inf_lowestprice").text("最低价：" + kRecord['lowestprice']);
                }

                if (this.preAimedKIdx != kidx) {
                    if (this.isMakingArea) {
                        this.selAreaEndIdx = kidx;
                        console.log("selAreaBeginIdx:" + this.selAreaBeginIdx + ", selAreaEndIdx:" + this.selAreaEndIdx);
                        console.log("making area rerendering...");
                        this.reRender();
                    }
                    this.preAimedKIdx = kidx;
                }


            }

            $("#info").html(info);

            //------------------------------------------

            if (this.isDraggingHs1) {
                this.splitLines.hs1.y = pos.y;
                this.reRender();
            } else {
                if (this.testNearHs1(pos.y)) {
                    $("#can").css("cursor","s-resize");
                } else {
                    if (this.isMakingArea) {
                        $("#can").css("cursor","w-resize");
                    } else {
                        if (this.testNearSelAreaBegin(pos.x)!==false) {
                            $("#can").css("cursor","w-resize");
                        } else if (this.testNearSelAreaEnd(pos.x)!==false) {
                            $("#can").css("cursor","w-resize");
                        } else {
                            $("#can").css("cursor","default");
                            //$("#can").css("cursor","crosshair");
                        }
                    }
                }


            }
        };

        Chart.prototype.onmousedown = function (e) {
            var pos = this.getPointOnCanvas(e.target, e.pageX, e.pageY);

            if (this.testNearHs1(pos.y)) {
                this.isDraggingHs1 = true;
            } else {
                var scl = this.displayScale.getScale();
                var sw = scl['s'];
                var kw = scl['k'];
                var tw = sw + kw;
                var a = (pos.x-1-sw)%tw;
                var b = Math.floor( (pos.x-1-sw)/tw );
                if (a < kw && a >= 0 && b >=0) {
                    info += "(K)&nbsp;";
                } else {
                    info += "(NK)&nbsp;";
                }
                info += "a=" + a + ",&nbsp;b=" + b;

                //c是鼠标最附近的那个K线的（加起始index之前的）index
                var c = b;
                if (a >= (kw+sw/2)) {
                    c++;
                }
                info += ",&nbsp;c=" + c;

                var dispBeginIdx = this.beginKBarIndex;
                var kidx = c + dispBeginIdx;
                if (this.selAreaBeginIdx===null) {
                    this.selAreaBeginIdx = kidx;
                    this.isMakingArea = true;
                } else if (!this.isMakingArea) {
                    var dBegin = this.testNearSelAreaBegin(pos.x);
                    var dEnd = this.testNearSelAreaEnd(pos.x);
                    if (typeof(dBegin)==="number" && dEnd===false) {
                        this.selAreaBeginIdx = this.selAreaEndIdx;
                        this.isMakingArea = true;
                    } else if (typeof(dEnd)==="number" && dBegin===false) {
                        this.isMakingArea = true;
                    } else if (typeof(dBegin)==="number" && typeof(dEnd)==="number") {
                        if (dBegin < dEnd) {
                            this.selAreaBeginIdx = this.selAreaEndIdx;
                        }
                        this.isMakingArea = true;
                    }
                }
            }
        };

        Chart.prototype.onmouseup = function (e) {
            if (this.isDraggingHs1) {
                this.isDraggingHs1 = false;
                $("#can").css("cursor","default");
            }
            if (this.isMakingArea) {
                this.isMakingArea = false;
                $("#can").css("cursor","default");
                if (typeof(this.selAreaBeginIdx)==="number") {
                    if (this.selAreaEndIdx == this.selAreaBeginIdx
                        || this.selAreaEndIdx===null)
                    {
                        this.selAreaBeginIdx = null;
                        this.selAreaEndIdx = null;
                        this.reRender();
                    }
                }
            }
        };

        Chart.prototype.onkeydown = function (e) {
            if (this.canv.onkeydown.lastWhich == e.which) {
                //一个小技巧：函数也是Object，所以里面也能存东西
                //而且运行到这里的时候，这个函数已经定义了，已经存在了，
                //所以一定可以用。
                //console.log("short quitting, lastWhich=" + can.onkeydown.lastWhich);
                return;
            }
            console.log("keydown, " + e.which);
            this.canv.onkeydown.lastWhich = e.which;
            switch (e.which) {
                case 38://UP
                    this.zoomIn();
                    break;
                case 40://DOWN
                    this.zoomOut();
                    break;
                case 37://LEFT
                    this.keyRepeater.turnOnKey("moveLeft");
                    break;
                case 39://RIGHT
                    this.keyRepeater.turnOnKey("moveRight");
                    break;
                case 81://Q
                    this.indicators['ma'].switchVisible();
                    break;
                case 65://A
                    this.prevMASystem();
                    break;
                case 83://S
                    this.nextMASystem();
                    break;
                case 49://1
                    //todo: 切换secondary1的显示内容
                    this.switchSecondaryIndicator();
                    break;
                case 50://2
                    //todo: 切换secondary2的显示内容
                    break;
                case 90://Z
                    //todo: 切换secondary2是否显示
                    break;
                case 220://backslash '\'
                    this.removeSelectedArea();
                    break;
                case 13://Enter
                    if (typeof(this.selAreaBeginIdx)==="number"
                        && typeof(this.selAreaEndIdx)==="number")
                    {
                        this.renderAutoScale(this.selAreaBeginIdx, this.selAreaEndIdx);
                    }
                    break;
                case 188://<
                    this.switchHigherKLevel();
                    break;
                case 190://>
                    this.switchLowerKLevel();
                    break;
            }
        };

        Chart.prototype.onkeyup = function (e) {
            this.canv.onkeydown.lastWhich = null;
            switch (e.which) {
                case 37:
                    this.keyRepeater.turnOffKey("moveLeft");
                    break;
                case 39:
                    this.keyRepeater.turnOffKey("moveRight");
                    break;
            }
        };

        Chart.prototype.alert = function (param) {
            this.canv.onkeydown.lastWhich = null;
            stockplayer.chart.keyRepeater.turnOffAllKeys();
            console.log("Chart.alert: " + param);
            alert(param);
        };

        Chart.prototype.testNearHs1 = function (y) {
            var soil = 5;
            if (y > this.splitLines.hs1.y - soil
                && y < this.splitLines.hs1.y + soil) {
                return true;
            } else {
                return false
            }
        };

        Chart.prototype.testNearSelAreaBegin = function (x) {
            if (this.selAreaBeginIdx) {
                var soil = 5;
                var scl = this.displayScale.getScale();
                var sw = scl['s'];
                var kw = scl['k'];
                var tw = sw + kw;
                var beginX = this.displayAreas["primary"].startX + sw + Math.floor(kw/2);
                var selAreaBeginX;
                // 注意，this.selAreaBeginIdx如果是在endIdx的右边，应该按照endX的计算法来计算
                if (this.selAreaBeginIdx && this.selAreaEndIdx && this.selAreaBeginIdx > this.selAreaEndIdx) {
                    selAreaBeginX = beginX + (this.selAreaBeginIdx - this.beginKBarIndex) * tw + Math.floor(tw/2);
                } else {
                    selAreaBeginX = beginX + (this.selAreaBeginIdx - this.beginKBarIndex) * tw - Math.floor(tw/2);
                }
                console.log("test near sel area begin, x="+x+", beginX="+selAreaBeginX);
                if (x > selAreaBeginX - soil
                    && x < selAreaBeginX + soil) {
                    return Math.abs(x-selAreaBeginX);
                }
            }
            return false;
        };

        Chart.prototype.testNearSelAreaEnd = function (x) {
            if (this.selAreaEndIdx) {
                var soil = 5;
                var scl = this.displayScale.getScale();
                var sw = scl['s'];
                var kw = scl['k'];
                var tw = sw + kw;
                var beginX = this.displayAreas["primary"].startX + sw + Math.floor(kw/2);
                var selAreaEndX;
                // 注意，this.selAreaEndIdx如果是在beginIdx的左边，应该按照beginX的计算法来计算
                if (this.selAreaBeginIdx && this.selAreaEndIdx && this.selAreaBeginIdx > this.selAreaEndIdx) {
                    selAreaEndX = beginX + (this.selAreaEndIdx - this.beginKBarIndex) * tw - Math.floor(tw/2);
                } else {
                    selAreaEndX = beginX + (this.selAreaEndIdx - this.beginKBarIndex) * tw + Math.floor(tw/2);
                }
                console.log("test near sel area end, x="+x+", endX="+selAreaEndX);
                if (x > selAreaEndX - soil
                    && x < selAreaEndX + soil) {
                    return Math.abs(x-selAreaEndX);
                }
            }
            return false;
        };

        return Chart;
    })();
    
    stockplayer.util = {};
    
    /**
    ** 如果dateText全部是数字，才处理，否则，就认为已经是标准格式，即使实际上并不是。
    **/
    stockplayer.util.standarize_datetime = function(dateText) {
        var reg = new RegExp("^(\\d+)$");
        var r = dateText.match(reg);
        if (r==null) {
            return dateText;
        }
        
        if (dateText.length <= 4) {
            return dateText + "01-01 9:30";
        } else if (dateText.length <= 6) {
            reg = new RegExp("^(\\d{4})(\\d+)$");
            r = dateText.match(reg);
            if(r!=null) {
                return r[1] + "-" + r[2] + "-01 9:30";
            }
        } else if (dateText.length <= 8) {
            reg = new RegExp("^(\\d{4})(\\d{2})(\\d+)$");
            r = dateText.match(reg);
            if(r!=null)
            {
                return r[1] + "-" + r[2] + "-" + r[3] + " 9:30";
            }
        } else if (dateText.length <= 12) {
            reg = new RegExp("^(\\d{4})(\\d{2})(\\d{2})(\\d{2})(\\d{2})$");
            r = dateText.match(reg);
            if(r!=null)
            {
                return r[1] + "-" + r[2] + "-" + r[3] + " " + r[4] + ":" + r[5];
            }
        }
        
        return "WARNING: something went VERY WRONG!!";
    };

    /*
     * 把有格式的datetime文本转成全是数字的文本
     */
    stockplayer.util.anti_standarize_datetime = function(dateText) {
        var reg = new RegExp("^(\\d+)-(\\d+)-(\\d+) (\\d+):(\\d+):(\\d+)$");
        var r = dateText.match(reg);
        if (r==null) {
            return null;
        }
        return r[1]+r[2]+r[3]+r[4]+r[5];
    };

    stockplayer.util.checkContainKTime = function (klines, ktime) {
        var dtktime = Date.parse(ktime);
        if (isNaN(dtktime)) {
            dtktime = Date.parse(ktime.replace(/-/g, '/'));
        }
        console.log("in checkContainKTime, ktime=" + ktime+ ", dtktime=" + dtktime);
        var dt1 = null;
        var dt2 = null;
        var i;
        var len = klines.length - 1;
        for (i = 0; i < len; ++i) {
            if (dt2) {
                dt1 = dt2;
            } else {
                dt1 = Date.parse(klines[i]["ktime"]);
                if (isNaN(dt1)) {
                    dt1 = Date.parse(klines[i]["ktime"].replace(/-/g, '/'));
                }
            }
            dt2 = Date.parse(klines[i+1]["ktime"]);
            if (isNaN(dt2)) {
                dt2 = Date.parse(klines[i+1]["ktime"].replace(/-/g, '/'));
            }
            if (dt1 <= dtktime && dt2 >= dtktime) {
                console.log("checkContainKTime returning " + (i+1));
                return i+1;
            }
        }
        console.log("checkContainKTime returning false");
        return false;
    };

    stockplayer.util.getLevelName = function (lv) {
        console.log("getLevelName, lv=" + lv);
        if (lv == '1m') {
            return "1分钟";
        } else if (lv == '5m') {
            return "5分钟";
        } else if (lv == '30m') {
            return "30分钟";
        } else if (lv == 'd') {
            return "日线";
        } else if (lv == 'w') {
            return "周线";
        }
        return "UNKNOWN LEVEL";
    };
    
    stockplayer.chart = new stockplayer.Chart();
    
    window.stockplayer = stockplayer;
    
})();
