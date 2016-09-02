/// <reference path='fourslash.ts' />

// Test that we can climb past more than one property access to reach a call expression.

////namespace A {
////    export namespace B {
////        export function f(value: number): void;
////        /*1*/export function f(value: string): void;
////        export function f(value: number | string) {}
////    }
////}
////A.B./*2*/f("");

goTo.marker("2");
goTo.definition();
verify.caretAtMarker("1");
