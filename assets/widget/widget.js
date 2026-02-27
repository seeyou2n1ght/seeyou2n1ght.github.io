/**
 * Star Office Widget v2 — OpenClaw 代理状态看板
 * 零依赖 (Vanilla JS)，通过 window.STAR_WIDGET_CONFIG 支持用户自定义
 */
(function () {
    'use strict';

    // =========================================================================
    // 默认配置 (用户可通过 window.STAR_WIDGET_CONFIG 覆盖任何字段)
    // =========================================================================
    const DEFAULTS = {
        apiUrl: '',
        agentName: 'OpenClaw',
        pollInterval: 5000,
        width: 400,
        height: 300,
        spriteSize: 40,
        position: 'bottom-right',   // 'bottom-right' | 'bottom-left' | 'inline'
        bgImage: '',                // 留空则使用同目录 office_bg.png
        spriteImage: '',            // 留空则使用同目录 lobster.png
        bubbleInterval: 10000,

        // 状态定义
        states: {
            idle: { name: '待命', area: 'idle' },
            thinking: { name: '思考中', area: 'thinking' },
            coding: { name: '编码中', area: 'coding' },
            searching: { name: '检索中', area: 'searching' },
            running: { name: '执行中', area: 'running' },
            error: { name: '异常', area: 'error' }
        },

        // 状态别名归一化映射 (外部传入 → 内部标准 key)
        stateAliases: {
            writing: 'coding',
            working: 'coding',
            researching: 'searching',
            research: 'searching',
            executing: 'running',
            run: 'running',
            planning: 'thinking',
            reasoning: 'thinking',
            syncing: 'idle',
            sync: 'idle',
            offline: 'idle',
            stuck: 'error'
        },

        // 区域坐标 (基于 400×300 画布)
        areas: {
            idle: { x: 310, y: 70 },   // 右上 — 沙发休息区
            thinking: { x: 80, y: 70 },   // 左上 — 书架区
            searching: { x: 80, y: 70 },   // 左上 — 书架区 (与 thinking 共享)
            coding: { x: 80, y: 180 },  // 左下 — 电脑桌
            running: { x: 280, y: 200 },  // 右下偏中 — 工作台
            error: { x: 340, y: 250 }   // 右下角 — 警报灯
        },

        // 气泡文案
        bubbleTexts: {
            idle: ['摸鱼中~', '有没有新任务？', '喝杯咖啡☕', '伸个懒腰', '看会儿风景'],
            thinking: ['让我想想…', '这个问题很有趣', '梳理一下思路', '分析中…'],
            coding: ['键盘冒烟!🔥', '码字如飞', '这段逻辑有点妙', '再检查一遍'],
            searching: ['翻阅资料~', '找到线索了!', '再深挖一点', '这篇文档不错'],
            running: ['跑起来！', '测试进行中', '部署到一半了', '马上就好~'],
            error: ['啊哦，卡住了', '需要修一修🔧', '呼叫主人!', '头顶冒烟💨']
        }
    };

    // =========================================================================
    // 合并用户配置
    // =========================================================================
    const USER_CFG = window.STAR_WIDGET_CONFIG || {};
    const CFG = {};

    // 浅合并顶层字段
    for (const key of Object.keys(DEFAULTS)) {
        if (typeof DEFAULTS[key] === 'object' && !Array.isArray(DEFAULTS[key]) && DEFAULTS[key] !== null) {
            CFG[key] = Object.assign({}, DEFAULTS[key], USER_CFG[key] || {});
        } else {
            CFG[key] = USER_CFG[key] !== undefined ? USER_CFG[key] : DEFAULTS[key];
        }
    }

    // 推断素材基础路径 (与 widget.js 同目录)
    const SCRIPT_BASE = (function () {
        try {
            const scripts = document.getElementsByTagName('script');
            const src = scripts[scripts.length - 1].src;
            return src.substring(0, src.lastIndexOf('/') + 1);
        } catch (_) {
            return '';
        }
    })();
    if (!CFG.bgImage) CFG.bgImage = SCRIPT_BASE + 'office_bg.png';
    if (!CFG.spriteImage) CFG.spriteImage = SCRIPT_BASE + 'lobster.png';

    // =========================================================================
    // 运行时状态
    // =========================================================================
    let currentState = 'idle';
    let currentDetail = '';
    let bubbleTimer = null;

    // =========================================================================
    // 状态归一化
    // =========================================================================
    function normalizeState(raw) {
        if (!raw) return 'idle';
        const s = String(raw).toLowerCase().trim();
        if (CFG.states[s]) return s;
        if (CFG.stateAliases[s]) return CFG.stateAliases[s];
        return 'idle';
    }

    // =========================================================================
    // UI 构建
    // =========================================================================
    function buildUI() {
        // 加载独立样式表 (与 widget.js 同目录)
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = SCRIPT_BASE + 'widget.css';
        document.head.appendChild(link);

        // Wrapper
        const wrapper = document.createElement('div');
        wrapper.id = 'star-widget-wrapper';
        wrapper.className = 'pos-' + CFG.position;

        // Canvas
        const canvas = document.createElement('div');
        canvas.id = 'star-widget-canvas';
        canvas.style.width = CFG.width + 'px';
        canvas.style.height = CFG.height + 'px';
        canvas.style.backgroundImage = "url('" + CFG.bgImage + "')";

        canvas.innerHTML =
            '<div id="star-widget-indicator" class="state-idle"></div>' +
            '<div id="star-widget-sprite" style="width:' + CFG.spriteSize + 'px;height:' + CFG.spriteSize + 'px;">' +
            '<img src="' + CFG.spriteImage + '" alt="' + CFG.agentName + '" />' +
            '<div id="star-widget-bubble"></div>' +
            '</div>' +
            '<div id="star-widget-statusbar">连接中...</div>';

        wrapper.appendChild(canvas);

        if (CFG.position === 'inline') {
            // 内联模式: 插入到用户准备的挂载点
            const mount = document.getElementById('star-widget-mount');
            if (mount) {
                wrapper.style.position = 'relative';
                mount.appendChild(wrapper);
            } else {
                console.warn('[StarWidget] inline 模式需要 <div id="star-widget-mount"></div>');
                return;
            }
        } else {
            document.body.appendChild(wrapper);
        }

        // 初始位置
        moveSprite('idle');
    }

    // =========================================================================
    // 角色移动
    // =========================================================================
    function moveSprite(stateKey) {
        const sprite = document.getElementById('star-widget-sprite');
        if (!sprite) return;
        const areaKey = (CFG.states[stateKey] || CFG.states.idle).area;
        const area = CFG.areas[areaKey] || CFG.areas.idle;
        // 随机偏移，让角色不呆板
        const ox = (Math.random() - 0.5) * 24;
        const oy = (Math.random() - 0.5) * 24;
        sprite.style.transform = 'translate(' + (area.x + ox) + 'px,' + (area.y + oy) + 'px)';
    }

    // =========================================================================
    // 气泡
    // =========================================================================
    function showBubble(stateKey) {
        const bubble = document.getElementById('star-widget-bubble');
        if (!bubble) return;
        const texts = CFG.bubbleTexts[stateKey] || CFG.bubbleTexts.idle;
        bubble.textContent = texts[Math.floor(Math.random() * texts.length)];
        bubble.style.opacity = '1';
        if (bubbleTimer) clearTimeout(bubbleTimer);
        bubbleTimer = setTimeout(function () { bubble.style.opacity = '0'; }, 3000);
    }

    // =========================================================================
    // 状态栏 & 指示灯
    // =========================================================================
    function updateStatusBar(stateKey, detail) {
        var bar = document.getElementById('star-widget-statusbar');
        if (!bar) return;
        var name = (CFG.states[stateKey] || CFG.states.idle).name;
        bar.textContent = '[' + name + '] ' + (detail || '...');

        // 更新右上角指示灯颜色
        var indicator = document.getElementById('star-widget-indicator');
        if (indicator) {
            indicator.className = 'state-' + stateKey;
        }
    }

    // =========================================================================
    // 网络轮询
    // =========================================================================
    function fetchStatus() {
        if (!CFG.apiUrl) return; // 无 API 则跳过网络请求

        fetch(CFG.apiUrl)
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                var next = normalizeState(data.state);
                var info = CFG.states[next] || CFG.states.idle;
                var bar = document.getElementById('star-widget-statusbar');
                var isInit = bar && bar.textContent === '连接中...';

                if (next !== currentState || isInit) {
                    moveSprite(next);
                    showBubble(next);
                }
                currentState = next;
                currentDetail = data.detail || '';
                updateStatusBar(currentState, currentDetail);
            })
            .catch(function (err) {
                console.error('[StarWidget]', err);
                updateStatusBar('error', '离线/不可达');
                moveSprite('error');
            });
    }

    // =========================================================================
    // 允许外部强制刷新 (用于 demo 或外部集成)
    // =========================================================================
    window.addEventListener('star-widget-force-fetch', fetchStatus);

    // =========================================================================
    // 启动
    // =========================================================================
    function start() {
        buildUI();
        fetchStatus();
        setInterval(fetchStatus, CFG.pollInterval);
        setInterval(function () {
            if (Math.random() > 0.6) showBubble(currentState);
        }, CFG.bubbleInterval);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
