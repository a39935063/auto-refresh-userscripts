// ==UserScript==
// @name         TeleAgent 刷新保活
// @namespace    teleagent-keepalive
// @version      4.0
// @description  TeleAgent 工作台页面自动刷新保活：计时和定时两种模式，随时切换
// @match        https://agent.teleai.com.cn/teleagent
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ===== 设置区：只改这里，改完按 Ctrl+S 保存，刷新页面就生效 =====
    // 模式：写 '计时' 或 '定时'（只能写一个）
    //   '计时'：每隔多少分钟刷一次
    //   '定时'：在每小时固定的第几分钟刷
    var 模式 = '计时';

    // 计时模式：每隔多少分钟刷新一次（只在模式='计时'时用）
    var 间隔分钟 = 15;

    // 定时模式：在每小时的第几分钟刷新（只在模式='定时'时用）
    // 00 到 59 都可以写，数字从小到大写，想刷几次就写几个
    // 比如 [0, 15, 30, 45] 就是每小时的 00、15、30、45 分刷新
    // 比如 [5, 25, 40] 就是每小时的 05、25、40 分刷新
    var 定时分钟 = [0, 15, 30, 45];
    // ===============================================================

    function 多久后刷新(毫秒) {
        setTimeout(function() {
            location.reload();
        }, 毫秒);
    }

    if (模式 === '定时') {
        // 定时模式：算到下一个设定的分钟刻度，刷新后重新计算下一个刻度
        (function 下一个定时() {
            var 现在 = new Date();
            var 下一次 = null;
            for (var i = 0; i < 定时分钟.length; i++) {
                var 分 = 定时分钟[i];
                if (分 > 现在.getMinutes()) {
                    下一次 = new Date(现在);
                    下一次.setMinutes(分, 0, 0);
                    break;
                }
            }
            if (!下一次) {
                下一次 = new Date(现在);
                下一次.setHours(现在.getHours() + 1);
                下一次.setMinutes(定时分钟[0], 0, 0);
            }
            多久后刷新(下一次 - 现在);
        })();
    } else {
        // 计时模式：每隔 间隔分钟 分钟刷新一次
        多久后刷新(间隔分钟 * 60 * 1000);
    }
})();
