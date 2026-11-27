// ==UserScript==
// @name         通用自动刷新（图形版）
// @namespace    auto-refresh-gui
// @version      1.0
// @description  任何页面都能自动刷新：右下角图形面板操作，计时和定时两种模式
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';

    // ===== 设置存在浏览器里，换页面也不会丢 =====
    var 设置 = {
        模式: GM_getValue('模式', '计时'),
        间隔分钟: GM_getValue('间隔分钟', 15),
        定时分钟: GM_getValue('定时分钟', '0,15,30,45'),
        运行中: GM_getValue('运行中', false),
        下次刷新: GM_getValue('下次刷新', 0)
    };
    function 存设置() {
        GM_setValue('模式', 设置.模式);
        GM_setValue('间隔分钟', 设置.间隔分钟);
        GM_setValue('定时分钟', 设置.定时分钟);
        GM_setValue('运行中', 设置.运行中);
        GM_setValue('下次刷新', 设置.下次刷新);
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

    // 算下一次刷新时间（返回时间戳）
    function 算下次刷新时间() {
        var 现在 = new Date();
        if (设置.模式 === '定时') {
            var 列表 = 分钟列表();
            for (var i = 0; i < 列表.length; i++) {
                if (列表[i] > 现在.getMinutes()) {
                    var 下一次 = new Date(现在);
                    下一次.setMinutes(列表[i], 0, 0);
                    return 下一次.getTime();
                }
            }
            var 下一小时 = new Date(现在);
            下一小时.setHours(现在.getHours() + 1);
            下一小时.setMinutes(列表[0], 0, 0);
            return 下一小时.getTime();
        }
        return 现在.getTime() + 设置.间隔分钟 * 60 * 1000;
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
        设置.下次刷新 = 算下次刷新时间();
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
        '<b>自动刷新</b>' +
        '<button id="刷新收起" title="收起" style="border:none;background:none;cursor:pointer;font-size:14px;line-height:1;">—</button>' +
        '</div>' +
        '<div id="刷新面板内容">' +
        '<div>模式：' +
        '<label><input type="radio" name="刷新模式" value="计时">计时</label> ' +
        '<label><input type="radio" name="刷新模式" value="定时">定时</label>' +
        '</div>' +
        '<div id="计时行">每隔 <input id="间隔分钟输入" type="number" min="1" style="width:52px;"> 分钟</div>' +
        '<div id="定时行" style="display:none;">每小时 <input id="定时分钟输入" type="text" style="width:110px;"> 分</div>' +
        '<div style="margin-top:6px;"><button id="开始停止" style="padding:2px 14px;cursor:pointer;">开始</button> <span id="刷新状态">已停止</span></div>' +
        '</div>';
    document.body.appendChild(面板);

    var 内容区 = document.getElementById('刷新面板内容');
    var 收起按钮 = document.getElementById('刷新收起');
    var 计时行 = document.getElementById('计时行');
    var 定时行 = document.getElementById('定时行');
    var 间隔输入 = document.getElementById('间隔分钟输入');
    var 定时输入 = document.getElementById('定时分钟输入');
    var 开始停止按钮 = document.getElementById('开始停止');
    var 状态文字 = document.getElementById('刷新状态');

    function 两位数(数) { return (数 < 10 ? '0' : '') + 数; }

    function 更新状态文字() {
        if (!设置.运行中) { 状态文字.textContent = '已停止'; return; }
        var 剩余 = 设置.下次刷新 - Date.now();
        if (剩余 < 0) 剩余 = 0;
        var 目标 = new Date(设置.下次刷新);
        var 分 = Math.floor(剩余 / 60000);
        var 秒 = Math.floor(剩余 % 60000 / 1000);
        状态文字.textContent = '下次 ' + 两位数(目标.getHours()) + ':' + 两位数(目标.getMinutes()) + '（还剩' + 分 + '分' + 秒 + '秒）';
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
    更新界面();
    setInterval(更新状态文字, 1000);
    if (设置.运行中) {
        if (设置.下次刷新 > Date.now()) { 安排刷新(); } else { 开始(); }
    }
})();
