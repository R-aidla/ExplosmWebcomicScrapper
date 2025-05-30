
// Shameless Copy + Paste section
import * as cheerio from 'cheerio';
import axios from 'axios';
import fs from 'fs';

const sleep = ms => new Promise(r => setTimeout(r, ms));

function getCache(name){
    if(fs.existsSync(`./cache/${name}.html`)){
        return fs.readFileSync(`./cache/${name}.html`);
    }
    return false;
}

function setCache(name, value){
    if(!fs.existsSync(`./cache/`)){
        fs.mkdirSync('./cache');
    }
    fs.writeFileSync(`./cache/${name}.html`, value);
}


// My meat and potatos

// Store the base url and conveniently made latest comic directory as a start point
const BASE_URL = 'https://explosm.net';
const LATEST_DIRECTORY = '/comics/latest';

// The main function that gets run. This will call getFirst10Comics() to get the first 10 comics starting from the latest.
// Await for all the comics and then print their scrapped info out on the console. 
(async () => {
  console.log(`You are running a comic scrapper of the page ${BASE_URL}. This is for educational purposes only.`)
  const comics = await getFirst10Comics();
  comics.forEach((comic, index) => {
    console.log(`Comic ${index + 1}:`);
    console.log(comic);
    console.log('---');
  });
})();

// Get the first 10 comics from the website and return them all by the end.
async function getFirst10Comics() {
  const comics = [];
  console.log('Getting latest comic URL...');
  let currentUrl = await resolveFinalUrl(BASE_URL + LATEST_DIRECTORY);
  await sleep(1000);
  console.log(currentUrl);

  while (comics.length < 10 && currentUrl) {
    console.log(`Grabbing ${currentUrl} data...`);
    const data = await getComicData(currentUrl);
    if (!data) break;
    comics.push(data);
    currentUrl = data.nextComicUrl;
  }

  return comics;
}

// Because of me wanting the titles of the comics, I needed to go from the '/comics/latest' directory to the actual comic URL.
// So this funtion will keep an eye on any redirects from '/comics/latest' to the appropriate directory.
async function resolveFinalUrl(url) {
  try {
    const response = await axios.get(url, {
      maxRedirects: 5,
      validateStatus: status => status >= 200 && status < 400
    });
    const finalUrl = response.request.res.responseUrl || response.request._redirectable._options.href;
    return finalUrl;
  } catch (error) {
    console.error('Error resolving final URL:', error);
    return null;
  }
}

// The title of the page is stored in the URL itself. Get it and store it.
function getTitleFromUrl(url) {
  const parsed = new URL(url);
  const segments = parsed.pathname.split('/').filter(Boolean);
  return segments[segments.length - 1];
}

// Because the URLs aren't simple numbers, I had to get the next/previous comic by find the previous comic button element.
// Thankfully, the previous button is currently always the first element. The next button is second. I don't need next.
// Get the href attribute and return the base url with the href attribute.
async function getPreviousComicLink(data) {
  try {
    const $ = cheerio.load(data);
    const comicLinks = [];

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');

      const regex = /^\/comics\/[^/]+#comic$/;
      if (regex.test(href)) {
        const segments = href.split('#').filter(Boolean); // Stinky.
        comicLinks.push(BASE_URL + segments[0]);
      }
    });

    return comicLinks[0];
  } catch (err) {
    console.error('Error:', err.message);
    return null;
  }
}

// The main function that rips and tears the page related to the URL, saves it and also returns an object containing info related to the page.
// If the page is already saved in the cache, load it's flesh from the cache and return an object containing info related to the page.
async function getComicData(url) {
  let data = getCache(getTitleFromUrl(url));
  if(!data){
    try {
      console.log('Grabbing from the web...');
      await sleep(1000)
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);

      const img = $('div#comic img');
      let imgUrl = img.attr('src');
      let title = getTitleFromUrl(url);

      console.log(`Saving ${title} comic data to cache...`);
      setCache(getTitleFromUrl(url), data)

      return {
        comicUrl: url,
        imageUrl: imgUrl,
        title: title,
        nextComicUrl: await getPreviousComicLink(data)
      };
    } catch (err) {
      console.error('Error fetching:', url);
      return null;
    }
  }
  console.log('Grabbing from the cache...');
  const $ = cheerio.load(data);
  let imgUrl = $('div#comic img').attr('src');
  return {
    comicUrl: url,
    imageUrl: imgUrl,
    title: getTitleFromUrl(url),
    nextComicUrl: await getPreviousComicLink(data)
  }
}

