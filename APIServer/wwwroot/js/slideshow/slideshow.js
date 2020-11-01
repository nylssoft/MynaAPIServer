"use strict";

var slideshow = (() => {

    // --- UI elements

    let divSlideShowInfo;
    let btnPlaySlideShow;
    let btnPauseSlideShow;
    let divFooter;

    // --- state

    let isSlideshowPlaying = true;

    let slideShowPictures;
    let slideShowInterval = 10;
    let backgroundChanged;
    let backgroundIndex = 0;
    let backgroundText;

    let passwordManagerEnabled = false;
    let username;

    // --- helper

    const getAuthenticationToken = () => {
        let pwdmanState;
        let str = window.sessionStorage.getItem("pwdman-state");
        if (str && str.length > 0) {
            pwdmanState = JSON.parse(str);
            if (pwdmanState && !pwdmanState.requiresPass2 && pwdmanState.token.length > 0) {
                return pwdmanState.token;
            }
        }
        return "";
    };

    const logout = () => {
        window.sessionStorage.removeItem("pwdman-state");
        let skatTicket = sessionStorage.getItem("ticket");
        if (!skatTicket) {
            skatTicket = localStorage.getItem("ticket");
        }
        if (skatTicket && skatTicket.length > 0) {
            window.sessionStorage.removeItem("ticket");
            window.localStorage.removeItem("ticket");
            fetch("api/skat/logout", { method: "POST", headers: { "ticket": skatTicket } })
                .then(response => response.json())
                .then(() => {
                    console.log("Skat logout completed.");
                    render();
                })
                .catch((err) => {
                    console.error(err);
                    render();
                });
        }
        else {
            render();
        }
    };

    // --- rendering

    const renderLinks = (parent) => {
        let div = controls.createDiv(parent);
        controls.createA(div, "footer-link", "/skat", "Skat");
        controls.createA(div, "footer-link", "/tetris", "Tetris");
        if (passwordManagerEnabled) {
            controls.createA(div, "footer-link", "/pwdman", "Passwort\u00A0Manager");
        }
        let token = getAuthenticationToken();
        if (token.length > 0) {
            controls.createA(div, "footer-link", "/pwdman", "Abmelden", logout);
            controls.createA(div, "footer-link", "/pwdman", "Kennwort\u00A0\u00E4ndern", () => {
                window.location.href = "/pwdman?changepwd&nexturl=" + encodeURI(window.location.href);                
            });
        }
        else {
            controls.createA(div, "footer-link", "/pwdman", "Anmelden", () => {
                window.location.href = "/pwdman?nexturl=" + encodeURI(window.location.href);
            });
            controls.createA(div, "footer-link", "/pwdman", "Registrieren", () => {
                window.location.href = "/pwdman?register&nexturl=" + encodeURI(window.location.href);
            });
        }
        controls.createA(div, "footer-link", "/downloads", "Downloads");
        controls.createA(div, "footer-link", "/impressum", "Impressum");
    };

    const renderSlideshowInfo = (parent) => {
        let div = controls.createDiv(parent);
        divSlideShowInfo = controls.createDiv(div, "slideshow-info");
        if (backgroundText) {
            divSlideShowInfo.textContent = backgroundText;
        }
        btnPauseSlideShow = controls.createImageButton(div, "Bildergalerie anhalten",
            () => {
                isSlideshowPlaying = false;
                btnPauseSlideShow.style.visibility = "hidden";
                btnPlaySlideShow.style.visibility = "visible";
            },
            "/images/skat/media-playback-pause-3.png", 24, "slideshow-action");
        btnPlaySlideShow = controls.createImageButton(div, "Bildergalerie abspielen",
            () => {
                isSlideshowPlaying = true;
                btnPauseSlideShow.style.visibility = "visible";
                btnPlaySlideShow.style.visibility = "hidden";
            },
            "/images/skat/media-playback-start-3.png", 24, "slideshow-action");
        btnPauseSlideShow.style.visibility = isSlideshowPlaying ? "visible" : "hidden";
        btnPlaySlideShow.style.visibility = !isSlideshowPlaying ? "visible" : "hidden";
    };

    const renderPage = () => {
        controls.removeAllChildren(document.body);
        if (username && username.length > 0) {
            let url;
            if (skatPlayerImages) {
                url = skatPlayerImages[username.toLowerCase()];
            }
            if (!url) {
                url = "/images/skat/profiles/Player1.png";
            }
            let img = controls.createImg(document.body, "img-profile", 32, 45, url);
            img.title = `Angemeldet als ${username}`;
        }
        divFooter = controls.createDiv(document.body, "footer");
        renderSlideshowInfo(divFooter);
        renderLinks(divFooter);
        window.onclick = (e) => {
            if (e.target.tagName == "HTML") {
                if (divFooter.style.visibility != "hidden") {
                    divFooter.style.visibility = "hidden";
                }
                else {
                    divFooter.style.visibility = "visible";
                }
            }
        };
    };

    const fetchFileinfo = () => {
        fetch("api/pwdman/fileinfo", { headers: { "token": getAuthenticationToken() } })
            .then(response => response.json().then(val => {
                if (response.ok && val === true) {
                    passwordManagerEnabled = true;
                }
                renderPage();
            }))
            .catch(err => {
                console.log(err.message);
                renderPage();
            });
    };

    const fetchUsername = () => {
        fetch("api/pwdman/username", { headers: { "token": getAuthenticationToken() } })
            .then(response => response.json().then(val => {
                if (response.ok && typeof val === "string") {
                    username = val;
                }
                fetchFileinfo();
            }))
            .catch(err => {
                console.log(err.message);
                fetchFileinfo();
            });
    };

    const render = () => {
        username = "";
        passwordManagerEnabled = false;
        let token = getAuthenticationToken();
        if (token.length == 0) {
            renderPage();
            return;
        }
        fetchUsername();
    };

    // --- callbacks

    const ontimer = () => {
        if (!slideShowPictures || slideShowPictures.length == 0 || !isSlideshowPlaying) return;
        let currentDate = new Date();
        if ((!backgroundChanged ||
                ((currentDate.getTime() - backgroundChanged.getTime()) / 1000) > slideShowInterval)) {
            let pic = slideShowPictures[backgroundIndex];
            document.body.style.background = `#000000 url('${pic.url}')`;
            document.body.style.backgroundSize = "cover";
            document.body.style.backgroundRepeat = "no-repeat";
            backgroundIndex = (backgroundIndex + 1) % slideShowPictures.length;
            backgroundChanged = currentDate;
            let txts = [pic.summary, pic.city, pic.country, utils.format_date(pic.date)];
            backgroundText = utils.concat_strings(txts, " // ");
            if (divSlideShowInfo) {
                divSlideShowInfo.textContent = backgroundText;
            }
        }
    }

    const initSlideShow = (pictures, interval) => {
        slideShowPictures = pictures;
        utils.shuffle_array(slideShowPictures);
        if (interval) {
            slideShowInterval = interval;
            ontimer();
            window.setInterval(ontimer, interval * 1000);
        }
    };

    // --- public API

    return {
        render: render,
        initSlideShow: initSlideShow,
        ontimer: ontimer
    };
})();

window.onload = () => {
    fetch("/images/slideshow/pictures.json", { cache: "no-cache" })
        .then(response => {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                response.json().then(model => {
                    slideshow.initSlideShow(model.pictures, model.interval);
                });
            }
            else {
                console.log("Slideshow disabled.");
            }
        })
    slideshow.render();
};
