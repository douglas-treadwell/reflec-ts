//// [parserES5ForOfStatement7.ts]
for (var a: number = 1, b: string = "" of X) {
}

//// [parserES5ForOfStatement7.js]
for (var _i = 0, X_1 = X; _i < X_1.length; _i++) {
    var a = 1 = X_1[_i];
}
