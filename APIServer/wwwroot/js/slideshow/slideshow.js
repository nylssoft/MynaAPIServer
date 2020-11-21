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

    let currentUser;

    // --- helper

    const onEditAccount = () => {
        window.location.href = "/usermgmt?nexturl=" + encodeURI(window.location.href);
    };

    // --- rendering

    const renderLinks = (parent) => {
        let div = controls.createDiv(parent);
        controls.createA(div, "footer-link", "/skat", "Skat");
        controls.createA(div, "footer-link", "/tetris", "Tetris");
        if (currentUser) {
            if (currentUser.hasPasswordManagerFile) {
                controls.createA(div, "footer-link", "/pwdman", "Passwort\u00A0Manager");
            }
            controls.createA(div, "footer-link", "/usermgmt", "Konto", () => onEditAccount());
        }
        else {
            controls.createA(div, "footer-link", "/pwdman", "Anmelden", () => {
                window.location.href = "/pwdman?nexturl=" + encodeURI(window.location.href);
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
        if (currentUser) {
            let url;
            if (skatPlayerImages) {
                url = skatPlayerImages[currentUser.name.toLowerCase()];
            }
            if (!url) {
                url = "/images/skat/profiles/Player1.png";
            }
            let img = controls.createImg(document.body, "img-profile", 32, 45, url);
            img.title = `Angemeldet als ${currentUser.name}`;
            img.addEventListener("click", () => onEditAccount());
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

    const fetchCurrentUser = (token) => {
        utils.fetch_api_call("api/pwdman/user", { headers: { "token": token } },
            (user) => {
                currentUser = user;
                renderPage();
            },
            (errmsg) => {
                console.error(errmsg);
                utils.logout();
                renderPage();
            });
    };

    const render = () => {
        currentUser = undefined;
        let token = utils.get_authentication_token();
        if (!token) {
            renderPage();
            return;
        }
        fetchCurrentUser(token);
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
    utils.auth_lltoken(slideshow.render);
};
