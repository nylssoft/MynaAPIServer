"use strict";

var downloads = (() => {

    const renderCopyright = (parent) => {
        let div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `Myna Downloads. Copyright 2020 `);
        let a = controls.createA(div, "copyright", "https://github.com/nylssoft/", "Niels Stockfleth");
        a.target = "_blank";
        let time = new Date().toLocaleTimeString("de-DE");
        controls.create(div, "span", "copyright", `. Alle Rechte vorbehalten. Letzte Aktualisierung: ${time}. `);
        controls.createA(div, "copyright", "/slideshow", "Home");
    };

    const renderMainPage = (parent, apps) => {
        controls.create(parent, "h1", undefined, "Downloads f\u00FCr Windows 10");
        apps.forEach( (app) => {
            let divApp = controls.createDiv(parent, "app");
            let p = controls.create(divApp, "h2", undefined, `${app.title} - ${app.version}`);
            controls.createButton(p, "Download", () => { window.location.href = `${app.download}`; });
            let a = controls.createA(p, "github", `${app.github}`, "GitHub");
            a.target = "_blank";
            controls.create(divApp, "p", undefined, `${app.description}`);
            if (app.prepare.length > 0) {
                let prepare = controls.create(divApp, "p", undefined, `Installationsvorraussetzung: ${app.prepare}`);
                if (app.preparedownload.length > 0) {
                    let ap = controls.createA(prepare, "prepare", `${app.preparedownload}`, "Microsoft");
                    ap.target = "_blank";
                }
            }
            controls.createImg(divApp, undefined, 400, 200, app.image);
        });
        renderCopyright(controls.createDiv(parent));
    };

    const render = (json) => {
        console.log(json);
        controls.removeAllChildren(document.body);
        let divMain = controls.createDiv(document.body);
        renderMainPage(divMain, json.apps);
    };

    // --- public API

    return {
        render: render
    };
})();

window.onload = () => {
    fetch("/downloads/apps.json", { cache: "no-cache" })
        .then(response => response.json())
        .then(json => downloads.render(json));
};
