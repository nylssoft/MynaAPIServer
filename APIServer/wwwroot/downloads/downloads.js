"use strict";

var downloads = (() => {

    const renderCopyright = (parent) => {
        let div = skatutil.createDiv(parent);
        skatutil.create(div, "span", "copyright", `Myna Downloads. Copyright 2020 `);
        let a = skatutil.createA(div, "copyright", "https://github.com/nylssoft/", "Niels Stockfleth");
        a.target = "_blank";
        let time = new Date().toLocaleTimeString("de-DE");
        skatutil.create(div, "span", "copyright", `. Alle Rechte vorbehalten. Letzte Aktualisierung: ${time}.`);
    };

    const renderMainPage = (parent, apps) => {
        skatutil.create(parent, "h1", undefined, "Downloads f\u00FCr Windows 10");
        apps.forEach( (app) => {
            let divApp = skatutil.createDiv(parent, "app");
            let p = skatutil.create(divApp, "h2", undefined, `${app.title} - ${app.version}`);
            skatutil.createButton(p, "Download", () => { window.location.href = `${app.download}`; });
            let a = skatutil.createA(p, "github", `${app.github}`, "GitHub");
            a.target = "_blank";
            skatutil.create(divApp, "p", undefined, `${app.description}`);
            if (app.prepare.length > 0) {
                let prepare = skatutil.create(divApp, "p", undefined, `Installationsvorraussetzung: ${app.prepare}`);
                if (app.preparedownload.length > 0) {
                    let ap = skatutil.createA(prepare, "prepare", `${app.preparedownload}`, "Microsoft");
                    ap.target = "_blank";
                }
            }
            skatutil.createImg(divApp, undefined, 400, 200, app.image);
        });
        renderCopyright(skatutil.createDiv(parent));
    };

    const render = (json) => {
        console.log(json);
        skatutil.removeAllChildren(document.body);
        let divMain = skatutil.createDiv(document.body);
        renderMainPage(divMain, json.apps);
    };

    // --- public API

    return {
        render: render
    };
})();

window.onload = () => {
    fetch("apps.json", { cache: "no-cache" })
        .then(response => response.json())
        .then(json => downloads.render(json));
};
