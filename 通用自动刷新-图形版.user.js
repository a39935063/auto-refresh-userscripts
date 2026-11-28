// ==UserScript==
// @name         通用自动刷新（图形版）
// @namespace    auto-refresh-gui
// @version      2.2
// @description  任何页面都能自动刷新：右下角图形面板操作，计时和定时两种模式；可以设时间段、日期范围和星期，面板可以拖动
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';

    // ===== 设置存在浏览器里，换页面也不会丢 =====
    var 设置 = {
        模式: GM_getValue('模式', '定时'),
        间隔分钟: GM_getValue('间隔分钟', 15),
        定时分钟: GM_getValue('定时分钟', '15'),
        开始小时: GM_getValue('开始小时', 8),
        结束小时: GM_getValue('结束小时', 24),
        开始日期: GM_getValue('开始日期', ''),
        结束日期: GM_getValue('结束日期', ''),
        星期: GM_getValue('星期', '0,1,2,3,4,5,6'),
        运行中: GM_getValue('运行中', false),
        下次刷新: GM_getValue('下次刷新', 0),
        面板左: GM_getValue('面板左', ''),
        面板上: GM_getValue('面板上', '')
    };
    function 存设置() {
        GM_setValue('模式', 设置.模式);
        GM_setValue('间隔分钟', 设置.间隔分钟);
        GM_setValue('定时分钟', 设置.定时分钟);
        GM_setValue('开始小时', 设置.开始小时);
        GM_setValue('结束小时', 设置.结束小时);
        GM_setValue('开始日期', 设置.开始日期);
        GM_setValue('结束日期', 设置.结束日期);
        GM_setValue('星期', 设置.星期);
        GM_setValue('运行中', 设置.运行中);
        GM_setValue('下次刷新', 设置.下次刷新);
        GM_setValue('面板左', 设置.面板左);
        GM_setValue('面板上', 设置.面板上);
    }

    var 刷新定时器 = null;

    // 把 "0,15,30,45" 这样的文字变成数字列表 [0, 15, 30, 45]
    function 分钟列表() {
        var 列表 = 设置.定时分钟.split(',').map(function(字) {
            return parseInt(字.trim(), 10);
        }).filter(function(数) {
            return !isNaN(数) && 数 >= 0 && 数 <= 59;
        }).sort(function(a, b) { return a - b; });
        return 列表.length ? 列表 : [0];
    }

    // 日期转 'YYYY-MM-DD' 文字
    function 日期字符串(日期) {
        var 年 = 日期.getFullYear();
        var 月 = 日期.getMonth() + 1;
        var 日 = 日期.getDate();
        return 年 + '-' + (月 < 10 ? '0' : '') + 月 + '-' + (日 < 10 ? '0' : '') + 日;
    }

    // 星期几的文字（0=星期日）
    function 星期文字(数) {
        return ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][数];
    }

    // 把 "0,1,2,3,4,5,6" 变成数字列表
    function 星期列表() {
        if (!设置.星期) return [];
        var 列表 = 设置.星期.split(',').map(function(字) {
            return parseInt(字.trim(), 10);
        }).filter(function(数) {
            return !isNaN(数) && 数 >= 0 && 数 <= 6;
        });
        return 列表;
    }

    // 判断某个时间是不是在工作时间段里（开始小时 <= 小时 < 结束小时，结束小时写 24 就是到午夜）
    // 注意：开始小时要小于结束小时
    function 在工作时间(日期) {
        var 小时 = 日期.getHours();
        return 小时 >= 设置.开始小时 && 小时 < 设置.结束小时;
    }

    // 判断某个日期是不是在日期范围里（开始日期或结束日期留空就是不限制）
    function 在日期范围(日期) {
        var 字 = 日期字符串(日期);
        if (设置.开始日期 && 字 < 设置.开始日期) return false;
        if (设置.结束日期 && 字 > 设置.结束日期) return false;
        return true;
    }

    // 判断某个日期是不是勾选的星期
    function 在星期(日期) {
        return 星期列表().indexOf(日期.getDay()) !== -1;
    }

    function 在日期和星期(日期) {
        return 在日期范围(日期) && 在星期(日期);
    }

    // 算到下一个工作开始的时间（今天还没到开始小时就是今天，否则明天）
    function 到工作开始(现在) {
        var 下一次 = new Date(现在);
        if (现在.getHours() >= 设置.结束小时) {
            下一次.setDate(下一次.getDate() + 1);
        }
        下一次.setHours(设置.开始小时, 0, 0, 0);
        return 下一次;
    }

    // 从“从日期”的第二天开始，找下一个允许的日期（最多找 366 天），找不到返回 null
    function 下一个允许日期(从日期) {
        var 天 = new Date(从日期);
        天.setHours(0, 0, 0, 0);
        for (var i = 0; i < 366; i++) {
            天.setDate(天.getDate() + 1);
            if (设置.结束日期 && 日期字符串(天) > 设置.结束日期) return null;
            if (在日期范围(天) && 在星期(天)) return 天;
        }
        return null;
    }

    // 算下一次刷新时间（返回时间戳，找不到返回 0）
    function 算下次刷新时间() {
        var 现在 = new Date();
        var 候选;
        if (设置.模式 === '定时') {
            var 列表 = 分钟列表();
            候选 = null;
            for (var i = 0; i < 列表.length; i++) {
                if (列表[i] > 现在.getMinutes()) {
                    候选 = new Date(现在);
                    候选.setMinutes(列表[i], 0, 0);
                    break;
                }
            }
            if (!候选) {
                候选 = new Date(现在);
                候选.setHours(现在.getHours() + 1);
                候选.setMinutes(列表[0], 0, 0);
            }
        } else {
            候选 = new Date(现在.getTime() + 设置.间隔分钟 * 60 * 1000);
        }
        // 逐步推进，直到候选时间落在允许的日期、星期、时间段里
        for (var 尝试 = 0; 尝试 < 400; 尝试++) {
            if (!在日期和星期(候选)) {
                var 下一天 = 下一个允许日期(候选);
                if (!下一天) return 0;
                候选 = 下一天;
                候选.setHours(设置.开始小时, 0, 0, 0);
                if (设置.模式 === '定时') {
                    候选.setMinutes(分钟列表()[0], 0, 0);
                } else {
                    候选 = new Date(候选.getTime() + 设置.间隔分钟 * 60 * 1000);
                }
                continue;
            }
            if (!在工作时间(候选)) {
                候选 = 到工作开始(候选);
                if (设置.模式 === '定时') {
                    候选.setMinutes(分钟列表()[0], 0, 0);
                } else {
                    候选 = new Date(候选.getTime() + 设置.间隔分钟 * 60 * 1000);
                }
                continue;
            }
            return 候选.getTime();
        }
        return 0;
    }

    function 清除刷新定时器() {
        if (刷新定时器) { clearTimeout(刷新定时器); 刷新定时器 = null; }
    }

    function 安排刷新() {
        清除刷新定时器();
        var 延迟 = 设置.下次刷新 - Date.now();
        if (延迟 < 0) 延迟 = 0;
        刷新定时器 = setTimeout(function() { location.reload(); }, 延迟);
    }

    function 开始() {
        var 下次 = 算下次刷新时间();
        if (!下次) {
            设置.运行中 = false;
            存设置();
            更新界面();
            return;
        }
        设置.下次刷新 = 下次;
        设置.运行中 = true;
        存设置();
        安排刷新();
        更新界面();
    }

    function 停止() {
        清除刷新定时器();
        设置.运行中 = false;
        存设置();
        更新界面();
    }

    // ===== 右下角面板 =====
    var 面板 = document.createElement('div');
    面板.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:999999;background:#fff;border:1px solid #ccc;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.25);font-size:13px;color:#333;width:230px;padding:10px;font-family:sans-serif;line-height:1.8;';
    面板.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
        '<b id="刷新标题" title="按住拖动可以移动面板" style="cursor:move;">自动刷新</b>' +
        '<button id="刷新收起" title="收起" style="border:none;background:none;cursor:pointer;font-size:14px;line-height:1;">—</button>' +
        '</div>' +
        '<div id="刷新面板内容">' +
        '<div>模式：' +
        '<label><input type="radio" name="刷新模式" value="计时">计时</label> ' +
        '<label><input type="radio" name="刷新模式" value="定时">定时</label>' +
        '</div>' +
        '<div id="计时行">每隔 <input id="间隔分钟输入" type="number" min="1" style="width:52px;"> 分钟</div>' +
        '<div id="定时行" style="display:none;">每小时 <input id="定时分钟输入" type="text" style="width:110px;"> 分<br><span style="font-size:11px;color:#888;">多个时间用逗号隔开，如 15,45</span></div>' +
        '<div id="时间段行" title="只在这个时间段里刷新，到了休息时间就不刷了；结束小时写 24 就是到午夜">时间段：<input id="开始小时输入" type="number" min="0" max="23" style="width:44px;"> 点到 <input id="结束小时输入" type="number" min="1" max="24" style="width:44px;"> 点</div>' +
        '<div id="日期行">开始日期 <input id="开始日期输入" type="date" style="width:128px;"><br>结束日期 <input id="结束日期输入" type="date" style="width:128px;"><br><span style="font-size:11px;color:#888;">留空就是不限制，每天都刷</span></div>' +
        '<div id="星期行">星期：' +
        '<label><input type="checkbox" class="星期勾选" value="1">一</label>' +
        '<label><input type="checkbox" class="星期勾选" value="2">二</label>' +
        '<label><input type="checkbox" class="星期勾选" value="3">三</label>' +
        '<label><input type="checkbox" class="星期勾选" value="4">四</label>' +
        '<label><input type="checkbox" class="星期勾选" value="5">五</label>' +
        '<label><input type="checkbox" class="星期勾选" value="6">六</label>' +
        '<label><input type="checkbox" class="星期勾选" value="0">日</label>' +
        '</div>' +
        '<div style="margin-top:6px;"><button id="开始停止" style="padding:2px 14px;cursor:pointer;">开始</button> <span id="刷新状态">已停止</span></div>' +
        '</div>';
    document.body.appendChild(面板);

    // 如果以前拖动过面板，就放在上次的位置
    if (设置.面板左 && 设置.面板上) {
        面板.style.right = 'auto';
        面板.style.bottom = 'auto';
        面板.style.left = 设置.面板左;
        面板.style.top = 设置.面板上;
    }

    var 内容区 = document.getElementById('刷新面板内容');
    var 收起按钮 = document.getElementById('刷新收起');
    var 标题 = document.getElementById('刷新标题');
    var 计时行 = document.getElementById('计时行');
    var 定时行 = document.getElementById('定时行');
    var 间隔输入 = document.getElementById('间隔分钟输入');
    var 定时输入 = document.getElementById('定时分钟输入');
    var 开始小时输入 = document.getElementById('开始小时输入');
    var 结束小时输入 = document.getElementById('结束小时输入');
    var 开始日期输入 = document.getElementById('开始日期输入');
    var 结束日期输入 = document.getElementById('结束日期输入');
    var 星期勾选 = document.querySelectorAll('.星期勾选');
    var 开始停止按钮 = document.getElementById('开始停止');
    var 状态文字 = document.getElementById('刷新状态');

    function 两位数(数) { return (数 < 10 ? '0' : '') + 数; }

    function 剩余文字(剩余毫秒) {
        var 总秒 = Math.floor(剩余毫秒 / 1000);
        var 天 = Math.floor(总秒 / 86400);
        var 小时 = Math.floor(总秒 % 86400 / 3600);
        var 分 = Math.floor(总秒 % 3600 / 60);
        var 秒 = 总秒 % 60;
        if (天 > 0) return '还剩' + 天 + '天' + 小时 + '小时';
        if (小时 > 0) return '还剩' + 小时 + '小时' + 分 + '分';
        return '还剩' + 分 + '分' + 秒 + '秒';
    }

    function 更新状态文字() {
        if (!设置.运行中) {
            if (设置.结束日期 && 日期字符串(new Date()) > 设置.结束日期) {
                状态文字.textContent = '已过结束日期';
                return;
            }
            状态文字.textContent = '已停止';
            return;
        }
        var 剩余 = 设置.下次刷新 - Date.now();
        if (剩余 < 0) 剩余 = 0;
        var 目标 = new Date(设置.下次刷新);
        // 下次刷新带上日期和星期，隔天的时候一眼就能看出来
        状态文字.textContent = '下次 ' + (目标.getMonth() + 1) + '月' + 目标.getDate() + '日 ' + 星期文字(目标.getDay()) + ' ' + 两位数(目标.getHours()) + ':' + 两位数(目标.getMinutes()) + '（' + 剩余文字(剩余) + '）';
    }

    function 更新界面() {
        开始停止按钮.textContent = 设置.运行中 ? '停止' : '开始';
        计时行.style.display = 设置.模式 === '计时' ? '' : 'none';
        定时行.style.display = 设置.模式 === '定时' ? '' : 'none';
        更新状态文字();
    }

    // 收起 / 展开
    收起按钮.addEventListener('click', function() {
        var 收起来 = 内容区.style.display !== 'none';
        内容区.style.display = 收起来 ? 'none' : '';
        收起按钮.textContent = 收起来 ? '+' : '—';
    });

    // 按住标题拖动面板（挡住文字时拖开就行，位置会记住，下次打开还在那）
    标题.addEventListener('mousedown', function(事件) {
        var 矩形 = 面板.getBoundingClientRect();
        var 偏移X = 事件.clientX - 矩形.left;
        var 偏移Y = 事件.clientY - 矩形.top;
        // 改成用左上角定位，才能跟着鼠标走
        面板.style.right = 'auto';
        面板.style.bottom = 'auto';
        面板.style.left = 矩形.left + 'px';
        面板.style.top = 矩形.top + 'px';
        function 移动( ev) {
            var 新左 = ev.clientX - 偏移X;
            var 新上 = ev.clientY - 偏移Y;
            if (新左 < 0) 新左 = 0;
            if (新上 < 0) 新上 = 0;
            if (新左 > window.innerWidth - 60) 新左 = window.innerWidth - 60;
            if (新上 > window.innerHeight - 40) 新上 = window.innerHeight - 40;
            面板.style.left = 新左 + 'px';
            面板.style.top = 新上 + 'px';
        }
        function 结束() {
            document.removeEventListener('mousemove', 移动);
            document.removeEventListener('mouseup', 结束);
            设置.面板左 = 面板.style.left;
            设置.面板上 = 面板.style.top;
            存设置();
        }
        document.addEventListener('mousemove', 移动);
        document.addEventListener('mouseup', 结束);
        事件.preventDefault();
    });

    // 切换模式
    var 模式选项 = document.querySelectorAll('input[name="刷新模式"]');
    for (var i = 0; i < 模式选项.length; i++) {
        模式选项[i].addEventListener('change', function() {
            设置.模式 = this.value;
            存设置();
            if (设置.运行中) { 开始(); } else { 更新界面(); }
        });
    }

    // 改间隔分钟
    间隔输入.addEventListener('change', function() {
        var 数 = parseInt(间隔输入.value, 10);
        if (isNaN(数) || 数 < 1) 数 = 15;
        设置.间隔分钟 = 数;
        间隔输入.value = 数;
        存设置();
        if (设置.运行中 && 设置.模式 === '计时') 开始();
    });

    // 改定时分钟
    定时输入.addEventListener('change', function() {
        设置.定时分钟 = 定时输入.value;
        存设置();
        if (设置.运行中 && 设置.模式 === '定时') 开始();
    });

    // 改开始小时
    开始小时输入.addEventListener('change', function() {
        var 数 = parseInt(开始小时输入.value, 10);
        if (isNaN(数) || 数 < 0) 数 = 0;
        if (数 > 23) 数 = 23;
        设置.开始小时 = 数;
        开始小时输入.value = 数;
        存设置();
        if (设置.运行中) 开始();
    });

    // 改结束小时
    结束小时输入.addEventListener('change', function() {
        var 数 = parseInt(结束小时输入.value, 10);
        if (isNaN(数) || 数 < 1) 数 = 1;
        if (数 > 24) 数 = 24;
        设置.结束小时 = 数;
        结束小时输入.value = 数;
        存设置();
        if (设置.运行中) 开始();
    });

    // 改开始日期 / 结束日期
    开始日期输入.addEventListener('change', function() {
        设置.开始日期 = 开始日期输入.value;
        存设置();
        if (设置.运行中) 开始();
    });
    结束日期输入.addEventListener('change', function() {
        设置.结束日期 = 结束日期输入.value;
        存设置();
        if (设置.运行中) 开始();
    });

    // 改星期勾选
    function 读星期勾选() {
        var 选中的 = [];
        for (var i = 0; i < 星期勾选.length; i++) {
            if (星期勾选[i].checked) 选中的.push(星期勾选[i].value);
        }
        设置.星期 = 选中的.join(',');
        存设置();
        if (设置.运行中) 开始();
    }
    for (var k = 0; k < 星期勾选.length; k++) {
        星期勾选[k].addEventListener('change', 读星期勾选);
    }

    // 开始 / 停止按钮
    开始停止按钮.addEventListener('click', function() {
        if (设置.运行中) { 停止(); } else { 开始(); }
    });

    // ===== 打开页面时的初始状态 =====
    for (var j = 0; j < 模式选项.length; j++) {
        if (模式选项[j].value === 设置.模式) 模式选项[j].checked = true;
    }
    间隔输入.value = 设置.间隔分钟;
    定时输入.value = 设置.定时分钟;
    开始小时输入.value = 设置.开始小时;
    结束小时输入.value = 设置.结束小时;
    开始日期输入.value = 设置.开始日期;
    结束日期输入.value = 设置.结束日期;
    var 已选星期 = 星期列表();
    for (var m = 0; m < 星期勾选.length; m++) {
        星期勾选[m].checked = 已选星期.indexOf(parseInt(星期勾选[m].value, 10)) !== -1;
    }
    更新界面();
    setInterval(更新状态文字, 1000);
    if (设置.运行中) {
        if (设置.下次刷新 > Date.now()) { 安排刷新(); } else { 开始(); }
    }
})();
