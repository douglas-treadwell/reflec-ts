//// [file1.ts]

interface PrivateInt {
    id:number;
}
export interface PublicInt {
    name:string;
}
export class MyClass implements PrivateInt, PublicInt{
	id:number;
    name:string;
}





//// [Reflection.js]
;(function(globalObj, undefined) {

    var freeExports = typeof exports == 'object' && exports;
    var freeModule = typeof module == 'object' && module && module.exports == freeExports && module;

    /** Detect free variable 'global' and use it as 'globalObj' */
    var freeGlobal = typeof global == 'object' && global;
    if (freeGlobal) {
        globalObj = freeGlobal;
    }
    var metadataField = (typeof Symbol === 'function') ? Symbol('metadata') : '__reflectionData__';
    function O_o(){return Object.create(null);} //lol

    var Reflection = globalObj.Reflection || { $libs:  O_o() };
    
    var _t, _l = [];

    for(var _cnt = 0; _cnt < 3; _cnt++ ) { _l[_cnt] = O_o(); }
    var _type_any = {kind: 'any'};
    var _type_string = {kind: 'string'};
    var _type_number = {kind: 'number'};
    var _type_boolean = {kind: 'boolean'};
    var _type_symbol = {kind: 'symbol'};
    var _type_void = {kind: 'void'};
    var _type_undefined = {kind: 'undefined'};
    var _type_null = {kind: 'null'};
    var _type_never = {kind: 'never'};
    Reflection.$libs['default'] = {
        'file1' : {
            'PrivateInt': _l[0],
            'PublicInt': _l[1],
            'MyClass': _l[2],
        },
    };
    _t = _l[0];
    _t.kind = 'interface';
    _t.name = 'PrivateInt';
    _t.members = [
        {
            name: 'id',
            type: _type_number,
        },
    ];
    _t = _l[1];
    _t.kind = 'interface';
    _t.name = 'PublicInt';
    _t.members = [
        {
            name: 'name',
            type: _type_string,
        },
    ];
    _t = _l[2];
    _t.kind = 'class';
    _t.name = 'MyClass';
    _t.members = [
        {
            name: 'id',
            type: _type_number,
        },
        {
            name: 'name',
            type: _type_string,
        },
    ];
    _t.implements = [_l[0], _l[1], ];

    Reflection.registerPackage = function(name) {
        //console.log('Registering package: ' + name);
        var pkg = Reflection.$libs['default'][name];
        pkg.registerClass = function(ctor, metadata) {
            //console.log('Registering constructor: ' + ctor.name);
            ctor.prototype[metadataField] = metadata;
            metadata.getConstructor = function(){ return ctor; };
        };
        //decorator:
        pkg.RegisterClass  = function(metadata) {
            return function(ctor) {
                //console.log('Invoking RegisterClass decorator for: ' + ctor.name);
                pkg.registerClass(ctor, metadata);
                return ctor;
            };
        };
        return pkg;
    };
    Reflection.interfaceForName = function(pkg, name) {
        var fqn = name ? [pkg, name] : pkg.split('#');
        var type = Reflection.$libs['default'][fqn[0]][fqn[1]];
        if(!type || type.kind !== 'interface') {
            throw new Error('Interface not found: '+ name);
        }
        return type;
    };
    Reflection.registerClass = function(ctor, name) {
        var metadata = Reflection.classForName(name);
        ctor.prototype[metadataField] = metadata;
        metadata.getConstructor = function(){ return ctor; };
    };
    Reflection.RegisterClass  = function(name) {
        return function(ctor) {
            //console.log('Invoking RegisterClass decorator for: ' + ctor.name);
            Reflection.registerClass(ctor, name);
            return ctor;
        };
    };

    Reflection.classForName = function(pkg, name) {
        var fqn = name ? [pkg, name] : pkg.split('#');
        var type = Reflection.$libs['default'][fqn[0]][fqn[1]];
        if(!type || type.kind !== 'class') {
            throw new Error('Class not found: '+ name);
        }
        return type;
    };
    Reflection.classForConstructor = function(ctor) {
        return ctor.prototype[metadataField];
    };
    Function.prototype.getClass = function() {
        return Reflection.classForConstructor(this);
    };

    globalObj.Reflection = Reflection;
    
}(this));

//// [file1.js]
"use strict";
exports.__esModule = true;
require("./Reflection");
exports.PublicInt = Reflection.interfaceForName("file1" + "#PublicInt");
var PrivateInt = Reflection.interfaceForName("file1" + "#PrivateInt");
var MyClass = (function () {
    function MyClass() {
    }
    return MyClass;
}());
exports.MyClass = MyClass;
Reflection.registerClass(MyClass, "file1" + "#MyClass");
