1.js�����װ�ͼ̳�

a.�����̳�
function A(name,age){
  this.name=name;
  this.age=age;
}
A.prototype.show=function(){
   alert(this.name)
}
function B(job){
  this.job=job;
}

for(var att in A.prototype){
  if(!B.protype[att]){
      B.prototype[att]=A.prototype[att]
  }
}
var b=new B('teacher');
b.show();

b.��ʽ�̳�
function A(name,age){
  this.name=name;
  this.age=age;
}
A.prototype.show=function(){
   alert(this.name)
}
function B(job){
  A.call(this,'Tom',11)
  this.job=job;
}
B.prototype=new A('Jim',10);
var b=new B('teacher');
b.show();

c.ԭ�ͼ̳�
function inheritPrototype(proto){
  var F=function(){};
  F.prototype=proto;
  return new F();
}
function A(name,age){
  this.name=name;
  this.age=age;
}
A.prototype.show=function(){
   alert(this.name)
}
function B(job){
  A.call(this,'Tom',11)
  this.job=job;
}
B.prototype=inheritPrototype(A.prototype);
var b=new B('teacher');
b.show();

2.dom Ready (DOMContentLoaded)�� window.onload
�������Ⱦ�����html��������

a.����html��ǩ
b.����dom��
c.����render��     -----------------------------> DOMContentLoaded
d.������ʽ��Ϣ     -----------------------------> window.onload
e.����render��
f.ȷ��domԪ�صĴ�Сλ����Ϣ
g.����render��
h.��Ⱦ��ҳ��


3.ԭ��ajax��д
var xhr=(function(){
	   var req;
           try{
              req=new XMLHttpRequest();
           }catch(ex){
	      try{
                 req=new ActiveXObject('Microsoft.XMLHTTP');
              }catch(ex){
		 try{
                    req=new ActiveXObject('MSXML2.XMLHTTP')
                 }catch(ex){
		    req=false;
                 }
              }
           }	
	   return req;
        })();

    xhr.onreadystatechange=function(){
       if(xhr.readyState==4&&xhr.status==200){
	   //�ɹ��ص�
           //���� xhr.responseText / xhr.responseXML
       }else{
           //����ص�
       }
    }

    xhr.open('GET/POST',url,true/false);

    xhr.setRequestHeader(header,value)    

    xhr.send(string)