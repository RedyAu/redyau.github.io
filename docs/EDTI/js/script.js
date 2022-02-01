//! 0: Igehird; 1: Podcast
let selectedPodcast = null;

let igehirdJson = null;
let podcastJson = null;
let episodesJson = null;

async function selectPodcast(id) {
    selectedPodcast = id;

    let prompt;
    if ((prompt = document.querySelector("#select-prompt")) !== null) prompt.remove();

    document.querySelector("#loader").innerHTML = `<div class="spinner-border" style="margin-top: 30vh;" role="status" id="center-spinner"></div>`;

    switch (selectedPodcast) {
        case 0:
            console.log("Selected: igehird");
            document.querySelector("#igehird-select").classList.add("active");
            document.querySelector("#podcast-select").classList.remove("active");
            if (igehirdJson === null) {
                igehirdJson = await getJson("https://raw.githubusercontent.com/reformatus/scrapecast/master/data/krek-data.json");
                console.log(igehirdJson.length);
            }
            episodesJson = igehirdJson;
            break;

        case 1:
            console.log("Selected: podcast");
            document.querySelector("#igehird-select").classList.remove("active");
            document.querySelector("#podcast-select").classList.add("active");
            if (podcastJson === null) {
                podcastJson = await getJson("https://raw.githubusercontent.com/reformatus/scrapecast/master/data/krekPodcast-data.json");
                console.log(podcastJson.length);
            }
            episodesJson = podcastJson;
            break;

        default:
            console.error("Invalid ID!");
            selectPodcast(0);
    }

    let htmlElements = "";
    episodesJson.forEach((element) => {
        htmlElements += `
        <div class="col">
        <div class="card">
            <div class="card-body">
                <div class="card-title">
                    <h5>
                        ${element.title}
                    </h5>
                </div>
            </div>
            <ul class="list-group list-group-flush">
                <li class="list-group-item"><b>Dátum: </b>${element.date}</li>
                <li class="list-group-item"><b>Előadó: </b>${element.pastor}</li>
                <li class="list-group-item"><b>Igehely: </b>${element.bible}</li>
            </ul>
            <div class="card-body"><div class="btn btn-secondary" id="${element.download}">Listen 🔈</div></div>
        </div>
    </div>`;
    });

    document.querySelector("#podcast-table").innerHTML = htmlElements;
    document.querySelector("#loader").innerHTML = ``;

    document.querySelectorAll(".btn").forEach((element) => {
        element.onclick = function () {
            element.parentElement.innerHTML = `<video controls autoplay><source src="https://krek.hu${element.id}" type="audio/mpeg">Incompatible!</source></video>`
        }
    });
}

async function getJson(link) {
    return new Promise((resolve, reject) => {
        let req = new XMLHttpRequest();
        req.open('GET', link);
        req.send();
        req.onload = function () {
            if (this.status >= 400) {
                console.error("Could not get JSON for " + link);
                reject(this.status);
            }
            console.log("Json OK");
            resolve(JSON.parse(this.response));
        }
    });
}

//! EVENTS
document.querySelector("#igehird-select").onclick = function () { selectPodcast(0) };
document.querySelector("#podcast-select").onclick = function () { selectPodcast(1) };