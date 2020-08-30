"use strict";

var utils = (() => {

    const concat_strings = (arr, delim) => {
        let str = "";
        let idx = 0;
        arr.forEach((a) => {
            if (a && a.length > 0) {
                if (idx > 0) {
                    str += delim;
                }
                str += a;
                idx++;
            }
        });
        return str;
    };

    const format_date = (dt) => {
        if (dt && dt.length > 0) {
            let locale = "de-DE";
            let options = { year: "numeric", month: "short", day: "numeric" };
            return new Date(dt).toLocaleDateString(locale, options);
        }
        return "";
    };

    const shuffle_array = (arr) => {
        let ridx;
        let tmp;
        let cidx = arr.length;
        while (0 !== cidx) {
            ridx = Math.floor(Math.random() * cidx);
            cidx -= 1;
            tmp = arr[cidx];
            arr[cidx] = arr[ridx];
            arr[ridx] = tmp;
        }
        return arr;
    };

    // --- public API

    return {
        concat_strings: concat_strings,
        format_date: format_date,
        shuffle_array: shuffle_array
    };
})();
