/* ===========================================================
 * jquery.pagescroll.js v0.0.1 单页/全屏滚动插件
 * ===========================================================
 * @author shenghanqin
 *
 * Study the jQuery plugin of Pete Rojwongsuriya.
 * http://www.thepetedesign.com
 *
 * Create an Apple-like website that let user scroll
 * one page at a time
 *
 * Credit: Eike Send for the awesome swipe event
 * https://github.com/peachananr/onepage-scroll
 *
 * License: GPL v3
 *
 * ========================================================== */

/*
 *
 * modernizr.transforms3d.js
 * 判断浏览器所能支持的特性，本插件所使用的modernizr 2.8.3使用定制版本
 * 网址：http://modernizr.com/download/#-csstransforms3d-shiv-cssclasses-teststyles-testprop-testallprops-prefixes-domprefixes-load
 * 在IE10+、Chrome、Safari、Firefox等浏览器上支持csstransforms3d，才可以使用page scroll
 * 在IE9-等浏览器上不支持csstransforms3d，所以就不启动page scroll
 *
 * Demo js调用
 * <script src="modernizr.js"></script>
 * <script type="text/javascript" src="jquery.js"></script>
 * <script type="text/javascript" src="jquery.pagescroll.js"></script>
 * <script>
 *     $(document).ready(function(){
 *         $(".main").page_scroll({
 *             sectionContainer: "section",
 *             headerContainer: '.header',
 *             footerContainer: '.footer',
 *             minHeight: 320,
 *             easing: 'cubic-bezier(.4,.01,.165,.99)',
 *             paginationTip: ['Page1', 'Page2', 'Page3']
 *        });
 *     });
 * </script>
 *
 * 插件说明
 * 在百度V5.7和搜狗3.7.4 对transform: translate3d(0, ?%, 0)中百分比不支持，所以改用px
 *
 */

/**

defaults: 默认参数，
    sectionContainer:       每次滚动所切换的整屏/单页，默认为section，可为html元素或.className
    headerContainer:        页面顶部，默认为.header，可为html元素或.className
    footerContainer:        页面底部，默认为.footer，可为html元素或.className
    
    pagination:             右侧页码是否显示，默认为true
    paginationTip:          右侧页码中的文字，默认为['']（必须加上一个空字符串），示例：['Page1', 'Page2']
    easing:                 切换动画，默认为ease，可为ease-in-out或者cubic-bezier()等
    animationTime:          页面动画时间，默认为1200ms
    beforeMove:             动画执行前的函数，默认为null
    afterMove:              动画执行后的函数，默认为null
    minHeight:              最小高度，小于此高度则不进行初始化
    };
 */

//Add semicolon to prevent IIFE from being passed as argument to concated code.
;
(function($) {
    var defaults = {
        sectionContainer: 'section',
        headerContainer: '.header',
        footerContainer: '.footer',
        wrapperClass: 'onepage-wrapper',
        subNavClass: '.onepage-nav',
        themeGrayClass: 'theme-t2-gray',
        themeDarkClass: 'theme-t2-dark',

        paginationContainer: 'onepage-pagination',
        paginationTemplate: ['<li>',
                                '<span class="outer-ring"></span>',
                                '<span class="inner-ring"></span>',
                                '<span class="page-title"></span>',
                            '</li>'].join(''),
        hasPagination: true,
        paginationTip: [''],

        // easeInOutQuint
        easing: 'cubic-bezier(.86, 0, .07, 1)',
        desktopAnimationTime: 1000,
        mobileAnimationTime: 400,
        beforeMove: null,
        afterMove: null,
        minHeight: 620
    };

    var isMobile = function() {
        return $(window).width() <= 736 && (screen.width <= 736 || window.devicePixelRatio >= 2)
    };

    // IE8/9
    var isOldIE = function () {
        return !$('html').hasClass('csstransforms3d');
    }

    /**
    changePosition   每一屏切换或者移动的位置
        @top 页面位移
        @time 动画时间
        @easing 动画曲线
    */
    var changePosition = function(el, top, time, easing, property) {
        // 过渡属性
        property = property || 'transform';
        var webkitProperty = property;

        if (property == 'transform') {
            webkitProperty = '-webkit-transform';
        }
        top = top + 'px';

        el.css({
            '-webkit-transform': 'translate3d(0, ' + top + ', 0)',
            '-webkit-transition': webkitProperty + ' ' + time + 'ms ' + easing,
            'transform': 'translate3d(0, ' + top + ', 0)',
            'transition': property + ' ' + time + 'ms ' + easing
        });
    };

    $.fn.pageScroll = function(options) {
        var el = $(this);

        // 页面中几个element，为$()形式。
        var element = {};
        // hasHeaderFooter 页面顶部/底部是否加入 index 中，是否作为页面滚动的元素，默认为 false
        // 当 hasHeaderFooter 为 false 时，请确保 header/footer 高度为 0
        var hasHeaderFooter = false;
        // 整屏切换结束的index
        var startIndex = 0;
        var endIndex = 0;
        // 整屏切换后所处的 el 所处的位置
        var endTop = 0;
        // 页面动画是否运行
        var isRunning = false;
        var isInit = false;

        // settings扩展配置
        var settings = $.extend({}, defaults, options);
        // 配置动画时间
        settings.animationTime = isMobile() ? settings.mobileAnimationTime : settings.desktopAnimationTime;

        var elementInit = function() {
            element = {
                header      : $(settings.headerContainer),
                footer      : $(settings.footerContainer),
                section     : $(settings.sectionContainer),
                pagination  : $('.' + settings.paginationContainer),
                subNav      : $(settings.subNavClass),
                _window     : $(window)
            };
            hasHeaderFooter = element.header.size() > 0 && element.footer.size() > 0;
            // 默认起始位置
            endIndex = hasHeaderFooter ? 0 : 1;
        };

        var setOptions = function(options) {
            $.extend(settings, options);
        };

        /*------------------------------------------------*/
        /*  Credit: Eike Send for the awesome swipe event */
        /*------------------------------------------------*/

        /*
            swipeEvents 滑动事件
            监听（on）touchstart/touchmove/touchend事件
            返回滑动方向（return）swipeLeft/swipeRight/swipeUp/swipeDown
        */
        $.fn.swipeEvents = function() {
            // 横向起始位置
            var startX;
            // 纵向起始位置
            var startY;
            // 横向截止位置
            var endX;
            // 纵向截止位置
            var endY;
            // 位移量 必须大于50
            // 页面高度
            var windowHeight = $(window).height();
            var positionXY = windowHeight * 0.25;
            // touchmove 监听计时器
            var timer;

            // 快速滑动
            var startTime;

            // 赋值$(this)的指向
            var $this = $(this);

            var getEventsPage = function(e) {
                var touchXY = {};
                // microsoft edge && ie11 window.PointerEvent && e.pointerType == 'touch'
                // ie10 window.navigator.msPointerEnabled && e.pointerType == e.MSPOINTER_TYPE_TOUCH
                // if ((window.PointerEvent && e.pointerType == 'touch') || (window.navigator.msPointerEnabled && !!e.pointerType && e.pointerType == e.MSPOINTER_TYPE_TOUCH)){
                if ((window.navigator.pointerEnabled && e.pointerType == 'touch') || (window.navigator.msPointerEnabled && !!e.pointerType && e.pointerType == e.MSPOINTER_TYPE_TOUCH)){
                    touchXY['y'] = e.pageY;
                    touchXY['x'] = e.pageX;
                } else if (e.changedTouches && e.changedTouches.length) {
                    // touchend 事件没有 touches 属性，改为 changedTouches
                    touchXY['y'] = e.changedTouches[0].pageY;
                    touchXY['x'] = e.changedTouches[0].pageX;
                }
                return touchXY;
            }

            function touchstart(event) {
                // 触摸导航的链接不响应
                if (event.target.tagName.toLowerCase() == 'a' && $(event.target).parents(settings.headerContainer).length) {
                    return;
                }

                var e = event.originalEvent;
                var touchXY = getEventsPage(e);

                if (!!touchXY.y) {
                    startX = touchXY['x'];
                    startY = touchXY['y'];
                    startTime = new Date().getTime();

                    // 快速划动，不触发 touchmove

                    timer = setTimeout(function() {
                        $this.on('touchmove pointermove MSPointerMove', touchmove);
                    }, 300);
                    // 阻止 iPad 默认的划动行为
                    event.preventDefault();

                }
            }

            function touchmove(event) {
                var e = event.originalEvent;
                var touchXY = getEventsPage(e);

                if (!!touchXY.y) {
                    // 加上preventDefault在T1、QQ浏览器上才能触发touchend事件
                    event.preventDefault();

                    // 滑动的位移/偏移
                    endX = startX - touchXY['x'];
                    endY = startY - touchXY['y'];

                    // 在首页和末页，只能跟随手指50px
                    // TODO
                    // 这里和有没有 header 没有关系
                    if (hasHeaderFooter) {
                        if (endIndex == 0) {
                            endY = ( 1 - 0.82 * Math.abs(endY) / windowHeight) * endY;
                            endY = endY <= -positionXY ? -(positionXY - 0.000001) : endY;
                        } else if (endIndex == element.section.length + 1){
                            endY = ( 1 - 0.82 * Math.abs(endY) / windowHeight) * endY;
                            endY = endY >= positionXY ? (positionXY - 0.000001) : endY;
                        }
                    } else {
                        if (endIndex == 1 && endY < 0) {
                            endY = ( 1 - 0.82 * Math.abs(endY) / windowHeight) * endY;
                            endY = endY <= -positionXY ? -(positionXY - 0.000001) : endY;
                        } else if (endIndex == element.section.length && endY > 0){
                            endY = ( 1 - 0.82 * Math.abs(endY) / windowHeight) * endY;
                            endY = endY >= positionXY ? (positionXY - 0.000001) : endY;
                        }
                    }

                    // 计算整屏需要的位移/偏移量
                    // 手指移动100%，屏幕移动50%
                    var pos = -endY / 2 + endTop;

                    // 如果touchend触发的动画不在进行中
                    if (!isRunning) {
                        // 页面跟随手指移动
                        // TODO
                        // 页面跟随手指移动不应该有缓动效果
                        changePosition(el, pos, 0, 'linear');
                        // 二级导航保持固定状态
                        subNav.toggle(endIndex, pos, 0, 'linear', 1);

                    }

                    // touches[0].pageY < 0  在ios系统微信中，pageY到达页面标题栏时触发
                    // startY >= windowHeight - 10  在ios系统的微信和Safari中，从底部滑出控制栏时触发
                    if (touchXY['y'] < 0 || startY >= windowHeight - 10 ) {
                        doSwipe();
                    }

                }
            }


            function touchend(event) {
                var e = event.originalEvent;
                var touchXY = getEventsPage(e);
                if (endY == 0) {
                    // 未触发 touchmove，touchend 需要更新 endY
                    endY = startY - touchXY['y'];
                }
                // var touches = event.originalEvent.changedTouches;
                // if (touches && touches.length) {
                // 判断是数字时，执行
                if (typeof endY == 'number') {
                    doSwipe();
                }
                // }
            } // toudend end

            function scrollBack() {
                // 位移过小，则页面回弹
                if (Math.abs(endY) < positionXY) {
                    var animationTime = settings.animationTime / 2;
                    changePosition(el, endTop, animationTime, 'cubic-bezier(0.455, 0.03, 0.515, 0.955)');
                    // changePosition(el, endTop, animationTime, 'cubic-bezier(.4,.01,.165,.99)');
                    subNav.toggle(endIndex, endTop, animationTime, 'cubic-bezier(0.455, 0.03, 0.515, 0.955)', 1);
                }

                // 关闭touchmove
                clearTimeout(timer);
                $this.off('touchmove pointermove MSPointerMove', touchmove);
            }

            function touchcancel(event) {
                scrollBack();
            } // touchcancel end

            function doSwipe () {
                    // 将swipeEvent与滑动方向绑定在一起
                    // $('a.back').html($('a.back').text() + '<br />' + (endY > 0 ? endY : '') )
                    var endTime = new Date().getTime();
                    var quickSwipeTime = endTime - startTime < 300;

                    if (endX >= 50 || (endX > 14 && quickSwipeTime)) {
                        $this.trigger('swipeLeft');
                    } else if (endX <= -50 || (endX < -14 && quickSwipeTime)) {
                        $this.trigger('swipeRight');
                    }


                    if (endY >= 50 || (endY > 14 && quickSwipeTime)) {
                        $this.trigger('swipeUp');
                    } else if (endY <= -50 || (endY < -14 && quickSwipeTime)) {
                        $this.trigger('swipeDown');
                    };

                    scrollBack();

                    endX = 0;
                    endY = 0;
            }

            function addTouchListner() {
                // ie10/ie11
                $this.on('touchstart pointerdown MSPointerDown', touchstart);
                $this.on('touchend pointerup MSPointerUp', touchend);
                $this.on('touchcancel pointercancel MSPointerCancel', touchcancel);

                $this.on('swipeDown', function(event){
                    mouseWheelHandler(event, 1);
                }).on('swipeUp', function(event){ 
                    mouseWheelHandler(event, -1);
                });
            }

            function removeTouchListner() {
                $this.off('touchstart pointerdown MSPointerDown', touchstart);
                $this.off('touchend pointerup MSPointerUp', touchend);
                $this.off('touchcancel pointercancel MSPointerCancel', touchcancel);

                $this.off('swipeDown swipeUp');
            }

            return {
                addTouchListner: addTouchListner,
                removeTouchListner: removeTouchListner
            };
        };

        // 右侧页码 settings.hasPagination
        var pagination = {
            // 初始化pagination
            init: function () {
                var me = this;
                // 往body上创建页码
                if (settings.hasPagination) {

                    if (element.pagination.length < 1) {
                        $('<ul class="'+ settings.paginationContainer +'"></ul>').insertAfter(el);
                        element.pagination = $('ul.' + settings.paginationContainer);
                        // element.pagination.css('opacity', 0);
                        sectionLength = element.section.length;

                        for (var i = 0; i < sectionLength; i++) {
                            // 页码文字
                            var tip = settings.paginationTip[i] || '';
                            $(settings.paginationTemplate).appendTo(element.pagination).find('.page-title').text(tip);
                        }
                    }

                    // 增加页面的active
                    me.toggleActive();
                    // pagination增加active
                    me.addListener();

                    // 手机上默认隐藏页码
                }
            },

            remove: function() {
                if (element.pagination) {
                    element.pagination.remove();
                }
            },

            show: function() {
                element.pagination.removeClass('hidden');
            },

            hide: function() {
                element.pagination.addClass('hidden');
            },

            // pagination更换active
            toggleActive: function() {
                var index = endIndex - 1;
                var me = this;
                if (index < 0) {
                    index = 0;
                }

                if (endIndex == 0 || endIndex > element.section.length) {
                    me.hide();
                } else {
                    me.show();
                }

                element.pagination.find('li').removeClass('active');
                element.pagination.find('li').eq(index).addClass('active');
            },

            // pagination增加监听
            addListener: function() {
                element.pagination.on('click', function(event) {
                    var target = event.target;

                    while ($(target).parents('li').length) {
                        target = target.parentNode;
                    }

                    if (target.tagName.toLowerCase() != 'li' || $(this).hasClass('active')) {
                        return;
                    }
                    
                    // 向下滚动一屏为 -1
                    var delta = -(($(target).index() + 1) - endIndex);

                    if (delta !== 0) {
                        doScroll(delta);
                    }
                });
            }

            // 页码上的文字
            // setPaginationTip: function (tip) {
            //     settings.paginationTip = tip;
            // }
        };

        // 顶部二级导航
        var subNav = {
            toggle: function(index, pos, time, easing, delta) {
                var me = this;

                //切换导航背景
                me.bgSwitch(index, delta);

                if (index === 0 && hasHeaderFooter) {
                    me.hide();
                // } else if (index == 1 && delta < 0) {
                    // me.show();
                } else {
                    me.show();
                    var subPos = -(pos + element.header.height());
                    changePosition(element.subNav, subPos, time, easing, 'all');
                }
            },
            // 切换导航背景
            bgSwitch: function(endIndex, delta) {
                var dark;
                if (endIndex==0) {
                    dark = element.section.eq(0).attr('data-background');
                } else {
                    dark = element.section.eq(endIndex - 1).attr('data-background');
                }

                if (dark == 'dark') {
                    element.subNav.addClass(settings.themeDarkClass).removeClass(settings.themeGrayClass);
                } else {
                    element.subNav.addClass(settings.themeGrayClass).removeClass(settings.themeDarkClass);
                }

                if (!!endIndex) {
                    element.subNav.removeClass('slide-up').removeClass('slide-down');
                    if (delta > 0) {
                        element.subNav.addClass('slide-down');
                    } else {
                        element.subNav.addClass('slide-up');
                    }
                }
            },


            show: function() {
                element.subNav.addClass('active');
            },

            hide: function() {
                element.subNav.removeAttr('style');
                element.subNav.removeClass('active');
            }
        };
        var page = {
            resizeTimer: 0,

            // 初始化
            init: function() {
                var me = this;
                me.prepare();
                me.resize();

                if(!hasHeaderFooter) {
                    element.section.eq(0).addClass('active');
                }
            },

            reset: function () {

                // 去掉Page Scroll渲染效果
                isInit = false;

                // 切换页面 重置isRunning
                isRunning = false;
                elementInit();
                pagination.remove();
                element.subNav.removeClass('header-dark');
                subNav.hide();

                el.removeAttr('style');

                element.section.removeAttr('style');
                $('html').removeClass(settings.wrapperClass);
                $('html, body').removeClass('hidden vertical-hidden');

                mouseWheel.off();
                $(document).off('mousedown', stopMouseWheelClick);
                swipeEvents.removeTouchListner();
                $(document).off('keydown', keyHandler);

                clearTimeout(timeout);
            },

            resize: function() {
                var me = page;
                if (!canScroll()) {
                    me.reset();
                } else if (isInit) {
                    var windowHeight = element._window.height();
                    element.section.height(windowHeight);

                    updateTop();
                    changePosition(el, endTop, 0, 'linear');
                    // 导航切换
                    subNav.toggle(endIndex, endTop, 0, 'linear', 1);
                } else {
                    init();
                }
            },

            resizeHandler: function() {

                var time = 250;
                var me = page;

                clearTimeout(me.resizeTimer);

                me.resizeTimer = setTimeout(function() {
                    me.resize();
                }, time);
            },

            // 准备
            prepare: function() {
                var len = element.section.length;

                for (var i = 0; i < len; i++) {
                    var current = element.section[i];
                    // hasHeaderFooter 为 true 时，进入section[0]时，active总会存在，到达header时section[0]失去active
                    // hasHeaderFooter 为 false 时，进入section[0],active总会会先消失，500ms再添加active
                    // 记录 section 获取 active 的时间
                    var timer = (hasHeaderFooter && i === 0) ? 0 : (settings.animationTime / 3);

                    current.timer = timer;
                };
            },

            // 给 section 增加 class，用于动画展示
            // active 用于激活，每次都播放动画
            // played 用于只播放一次的动画
            // slide-up/slide-down 用于滚动方向不同时播放不同动画
            toggleActive: function(endIndex, delta) {
                var me = this;
                // 去掉 header 和 footer 的 index
                var index = endIndex - 1;
                var current = element.section[index];
                var len = element.section.length;

                // 回到初始状态时，去掉第一屏的active
                if (index < 0) {
                    $(element.section[0]).removeClass('active');
                    return;
                }

                // 从 footer 返回时不重新 active
                if (!(delta > 0 && current == element.section[len - 1])) {
                    $(current).removeClass('active');
                }


                if (current) {
                    // active 需要延迟添加才会重新激活动画

                    if (current.timer > 0) {
                        setTimeout(function() {
                            $(current).addClass('active');
                            $(current).addClass('played');
                        }, current.timer);
                    } else {
                        $(current).addClass('active');
                        $(current).addClass('played');
                    }
                }

                $(current).removeClass('slide-up').removeClass('slide-down');
                if (delta > 0) {
                    $(current).addClass('slide-down');
                } else {
                    $(current).addClass('slide-up');
                }
            }
        };

        // 计算当前在第几页
        var updateIndex = function(delta) {
            // delta -1 页面向上，滚轮向下，滚动条向下
            // 方向效果类似于 top 设为负值
            var pageSize = hasHeaderFooter ? element.section.length + 2 : element.section.length;

            startIndex = endIndex;

            if (delta < 0) {
                endIndex += Math.abs(delta);
            } else {
                endIndex -= Math.abs(delta);
            }

            // endIndex [0, pageSize - 1]
            // 不能超出范围
            endIndex = Math.min(endIndex, pageSize - 1);
            endIndex = Math.max(endIndex, 0);

            return;
        };

        // 计算滚动之后 wrapper 的 top 值
        var updateTop = function() {
            // footer 比 pagination 的 index 大
            // isFooter = (endIndex == element.section.length + 1);

            var headerHeight = element.header.height();
            var footerHeight = element.footer.height();
            var windowHeight = element._window.height();

            switch (endIndex) {
                case 0:
                    endTop = 0;
                    break;
                case element.section.length + 1:
                    endTop = ((endIndex - 2) * windowHeight + headerHeight + footerHeight) * -1;
                    break;
                default:
                    endTop = ((endIndex - 1) * windowHeight + headerHeight) * -1;
                    break;
            }
        };

        // 当用户通过鼠标滚轮与页面交互、在垂直方向上滚动页面时，就会触发mousewheel事件
        // 这个事件可以在任何元素上面触发，最终会冒泡到document(IE)或window(Opera、Chrome、及Safari)对象。
        // 与mousewheel事件对应的event对象包含一个特殊的wheelDelta属性。
        // 向前滚动鼠标滚轮时，wheelDelta为正；当用户向后滚动鼠标滚轮时，wheelDelta为负
        var mouseWheelHandler = function(event, delta) {
            event.preventDefault();

            // 这里鼠标没有给delta
            if (!delta) {
                var e = event.originalEvent;
                if (typeof e.wheelDeltaY != 'undefined') {
                    delta = e.wheelDeltaY;
                } else {
                    delta = e.wheelDelta || -e.detail;    
                }
                
            }

            // Chrome on Mac 升级到 46.0.2490.71
            // 轻触触摸板 delta 返回 0
            // 原来的逻辑会触发向下滚动
            if (delta === 0) {
                return;
            }

            // 每次只滚动一屏
            if (delta > 0) {
                delta = 1;
            } else {
                delta = -1;
            }

            // 进行滚动
            doScroll(delta);
        };

        var mouseWheel = {
            on: function() {
                $(document).on('mousewheel DOMMouseScroll', mouseWheelHandler);
            },
            off: function() {
                $(document).off('mousewheel DOMMouseScroll', mouseWheelHandler);
            }
        };

        var keyHandler = function (event) {
            var tagName = event.target.tagName.toLowerCase();

            if (mouseWheel != 'input' && mouseWheel != 'textarea') {
                switch(event.which) {
                    case 38:
                        doScroll(1);
                        break;
                    case 40:
                        doScroll(-1);
                        break;
                    case 32: //spacebar
                        doScroll(-1);
                        break;
                    case 33: //pageg up
                        doScroll(1);
                        break;
                    case 34: //page dwn
                        doScroll(-1);
                        break;
                    default:
                        break;
                }
            }
        };

        var stopMouseWheelClick = function(event) {
            if(event.which == 2) {
                return false;
            }
        };

        var stopMouseSelectScroll = function() {
            if(!isMobile) {
                $(window).scrollTop(0);
            }
        };

        var timeout;

        var doScroll = function(delta) {

            if (isRunning) {
                return;
            }

            isRunning = true;
            // 修复 mousewheel 多次触发引起的页面跳动 bug
            mouseWheel.off();

            timeout = setTimeout(function() {
                isRunning = false;
                mouseWheel.on();
            }, settings.animationTime + 500);

            // 更新 endIndex
            updateIndex(delta);

            // 执行动画
            el.transformPage(settings, startIndex, endIndex, delta);
        };

        // 切换页面
        $.fn.transformPage = function(settings, startIndex, endIndex, delta) {
            if (startIndex == endIndex) {
                return;
            }

            var easing = settings.easing;
            var time = settings.animationTime;

            if (hasHeaderFooter && (endIndex === 0 || (endIndex === 1 && delta < 0)) ) {
                // easeOutQuart
                easing = 'cubic-bezier(.165, .84, .44, 1)';
                // time = 1200;
            }

            if (typeof settings.beforeMove == 'function') {
                settings.beforeMove(endIndex, time, easing, delta);
            }

            // 更新 endTop
            updateTop();
            changePosition(el, endTop, time, easing);
            // 导航切换
            subNav.toggle(endIndex, endTop, time, easing, delta);

            $(this).on('webkitTransitionEnd otransitionend oTransitionEnd msTransitionEnd transitionend', function(e) {
                var target = e.target;

                // 保证是 wrapper 动画执行完毕
                if (target == $(this)[0] && typeof settings.afterMove == 'function') {
                    element.subNav.removeClass('slide-up').removeClass('slide-down');
                    settings.afterMove(endIndex, time, easing, delta);

                    $(this).off('webkitTransitionEnd otransitionend oTransitionEnd msTransitionEnd transitionend');
                }
            });

            page.toggleActive(endIndex, delta);
            // pagination 切换 active 状态
            pagination.toggleActive();
        };

        // 判断是否开启page scroll
        // true为开启，false为关掉
        var canScroll = function() {
            var result = false;

            // result = element._window.height() >= settings.minHeight && element._window.width() > element._window.height();
            result = element._window.height() >= settings.minHeight;

            // 请注意这里返回的时相反的值
            return result;
        };

        

        var swipeEvents = el.swipeEvents();

        // reset 清除所有的page scroll设置
        var reset = function() {
            // 页面内清除Page Scroll
            page.reset();

            // 页面切换间清除Page Scroll
            $(window).off('resize', page.resizeHandler);
        };

        // 渲染Page Scroll 效果
        var start = function () {
            // Prepare everything before binding wheel scroll
            $('html').addClass(settings.wrapperClass);

            //针对mac平台浏览器overflow调整
            if (navigator.userAgent.indexOf('Mac') > 0) {   
                $('html, body').addClass('hidden');
            } else {
                $('html, body').addClass('vertical-hidden');
            }

            // 将页面滚动到顶部
            $("html,body").animate({
                scrollTop: 0
            }, {
                queue: !1
            }, 10);

            // section 增加 active
            page.init();

            // 页码导航
            pagination.init();

            // 添加事件监听
            // 鼠标滚轮
            mouseWheel.on();

            // 禁止鼠标滚轮点击出现方向图标
            $(document).on('mousedown', stopMouseWheelClick);

            // touch
            swipeEvents.addTouchListner();

            $(window).on('resize', page.resizeHandler);

            $(document).on('keydown', keyHandler);

            // TODO
            // 在 windows 上试一下
            // $(window).on('scroll', stopMouseSelectScroll);
        };

        var init = function() {
            if (isOldIE()) {
                // IE89直接停在active的状态
                $(settings.sectionContainer).addClass('active');
                return;
            }

            // 需要初始化元素，以便后期引用
            elementInit();

            if(!canScroll()) {
                $(settings.sectionContainer).addClass('active');
                return;
            }

            // 渲染了Page Scroll
            isInit = true;
            start();
        };

        // 执行一次  在 ie10+、chrome、Safari、Firefox 等浏览器上使用 page scroll
        // init();

        return {
            // setPaginationTip: pagination.setPaginationTip,
            setOptions: setOptions,
            reset: reset,
            init: init
        };
    };
}(window.jQuery));
