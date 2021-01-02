"use strict";

var downloads = (() => {

    const renderDropdown = (parent) => {
        let dropdownDiv = controls.create(parent, "div", "dropdown");
        let dropdownButton = controls.createImg(dropdownDiv, "dropbtn", 24, 24, "/images/downloads/hamburger.svg");
        dropdownButton.addEventListener("click", () => {
            document.getElementById("dropdown-id").classList.toggle("show");
        });
        let dropdownContentDiv = controls.create(dropdownDiv, "div", "dropdown-content");
        dropdownContentDiv.id = "dropdown-id";
    };

    const renderDropdownContent = () => {
        let parent = document.getElementById("dropdown-id");
        if (!parent) return;
        controls.removeAllChildren(parent);
        controls.createA(parent, undefined, "/slideshow", "Bildergalerie");
        controls.createA(parent, undefined, "/notes", "Notizen");
        controls.createA(parent, undefined, "/skat", "Skat");
        controls.createA(parent, undefined, "/diary", "Tagebuch");
        controls.createA(parent, undefined, "/tetris", "Tetris");
    };

    const renderCopyright = (parent) => {
        let div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", "Myna Downloads. Copyright 2020-2021 ");
        let a = controls.createA(div, "copyright", "https://github.com/nylssoft/", "Niels Stockfleth");
        a.target = "_blank";
        controls.create(div, "span", "copyright", ".");
    };

    const renderMainPage = (parent, apps) => {
        renderDropdown(parent);
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
            controls.createImg(divApp, undefined, 350, 200, app.image);
        });
        renderCopyright(controls.createDiv(parent));
        renderDropdownContent();
    };

    const render = (json) => {
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
