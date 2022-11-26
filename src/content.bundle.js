'use strict';

console.log("sdf", document.body);
document.addEventListener("DOMContentLoaded", function(event) {
    document.body.style.border = "5px solid red";
});
document.body.style.border = "5px solid red";
//const audio = new AudioPlayback();

setInterval(() => {
    console.log("ffffoooo");
}, 1000);

function foo() {
    console.log("func ffffffffffffffffffffff");
}

console.log("updated contentscript1");
chrome.runtime.onMessage.addListener((msg) => {
    console.log("msg", msg);
    foo();
});
console.log("updated contentscript12");
