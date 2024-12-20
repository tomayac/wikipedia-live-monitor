'use strict';

const EventSource = require('eventsource');
var request = require('request');
var express = require('express');
var app = express();
const http = require('http');
const socketIo = require('socket.io');
// Create an HTTP server
const server = http.createServer(app); // Assuming `app` is your Express app
// Create a new Socket.IO instance and attach it to the HTTP server
const io = socketIo(server);
var $ = require('cheerio');
var nodemailer = require('nodemailer');
var socialNetworkSearch = require('./social-network-search.js');
var wiki2html = require('./wiki2html.js');
var wikipedias = require('./wikipedias.js');
// var illustrator = require('./mediagallery.js');
var env = require('node-env-file');
if (require('fs').existsSync(__dirname + '/.env')) {
  env(__dirname + '/.env');
}

// verbous debug mode
var VERBOUS = true;
// really very verbous debug mode
var REALLY_VERBOUS = true;
// use WebSocket reporting
var USE_WEBSOCKETS = true;

// whether to monitor the 1,000,000+ articles Wikipedias
var MONITOR_SHORT_TAIL_WIKIPEDIAS = true;

// whether to monitor the 100,000+ articles Wikipedias
var MONITOR_LONG_TAIL_WIKIPEDIAS = true;

// whether to also monitor the << 100,000+ articles Wikipedias
var MONITOR_REALLY_LONG_TAIL_WIKIPEDIAS = true;

// whether to monitor the knowledge base Wikidata
var MONITOR_WIKIDATA = true;

// an article cluster is thrown out of the monitoring loop if its last edit is
// longer ago than SECONDS_SINCE_LAST_EDIT seconds
var SECONDS_SINCE_LAST_EDIT = 240;

// an article cluster may have at max SECONDS_BETWEEN_EDITS seconds in between
// edits in order to be regarded a breaking news candidate
var SECONDS_BETWEEN_EDITS = 60;

// an article cluster must have at least BREAKING_NEWS_THRESHOLD edits before it
// is considered a breaking news candidate
var BREAKING_NEWS_THRESHOLD = 5;

// an article cluster must be edited by at least NUMBER_OF_CONCURRENT_EDITORS
// concurrent editors before it is considered a breaking news candidate
var NUMBER_OF_CONCURRENT_EDITORS = 3;

// Wikipedia edit bots can account for many false positives, so usually we want
// to discard them
var DISCARD_WIKIPEDIA_BOTS = true;

// required for Wikipedia API
var USER_AGENT = 'Wikipedia Live Monitor * ' + ' Contact: tomac(a)google.com.';

// if enabled, breaking news candidates will be emailed
var EMAIL_BREAKING_NEWS_CANDIDATES =
  process.env.EMAIL_BREAKING_NEWS_CANDIDATES.toLowerCase().trim() === 'false'
    ? false
    : true;

var IP_V6 =
  /(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]).){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]).){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))/g;
var IP_V4 =
  /((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])/;

if (EMAIL_BREAKING_NEWS_CANDIDATES) {
  // create reusable transport method (opens pool of SMTP connections)
  var smtpTransport = nodemailer.createTransport('SMTP', {
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_ADDRESS,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
  var recentEmailsBuffer = [];
}

var WIKIPEDIAS = [];
var PROJECT = '.wikipedia.org';
if (MONITOR_SHORT_TAIL_WIKIPEDIAS) {
  Object.keys(wikipedias.millionPlusLanguages).forEach(function (language) {
    if (wikipedias.millionPlusLanguages[language]) {
      WIKIPEDIAS.push(language + PROJECT);
    }
  });
}
if (MONITOR_LONG_TAIL_WIKIPEDIAS) {
  Object.keys(wikipedias.oneHundredThousandPlusLanguages).forEach(
    function (language) {
      if (wikipedias.oneHundredThousandPlusLanguages[language]) {
        WIKIPEDIAS.push(language + PROJECT);
      }
    }
  );
}
if (MONITOR_REALLY_LONG_TAIL_WIKIPEDIAS) {
  Object.keys(wikipedias.reallyLongTailWikipedias).forEach(function (language) {
    if (wikipedias.reallyLongTailWikipedias[language]) {
      WIKIPEDIAS.push(language + PROJECT);
    }
  });
}
if (MONITOR_WIKIDATA) {
  Object.keys(wikipedias.wikidata).forEach(function (language) {
    if (wikipedias.wikidata[language]) {
      WIKIPEDIAS.push(language + PROJECT);
    }
  });
}

const url = 'https://stream.wikimedia.org/v2/stream/recentchange';
const eventSource = new EventSource(url);

eventSource.onopen = () => {
  console.info('Opened connection.');
};

eventSource.onerror = (event) => {
  console.error('Encountered error', event);
};

// global objects, required to keep track of the currently monitored articles
// and article clusters for the different language versions
var articles = {};
var articleClusters = {};
var articleVersionsMap = {};

function parseMessage(message, to) {
  // get the editor's username or IP address
  // the IRC log format is as follows (with color codes removed):
  // rc-pmtpa: [[Juniata River]] http://en.wikipedia.org/w/index.php?diff=
  // 516269072&oldid=514659029 * Johanna-Hypatia * (+67) Category:Place names
  // of Native American origin in Pennsylvania
  var messageComponents = message.split(' * ');
  var articleRegExp = /\[\[(.+?)\]\].+?$/;
  var article = messageComponents[0].replace(articleRegExp, '$1');
  // discard non-article namespaces, as listed here:
  // http://www.mediawiki.org/wiki/Help:Namespaces
  // this means only listening to messages without a ':' essentially
  if (article.indexOf(':') !== -1) {
    return false;
  }
  var editor = messageComponents[1];
  // discard edits made by bots.
  // bots are identified by a B flag, as documented here
  // http://www.mediawiki.org/wiki/Help:Tracking_changes
  // (the 'b' is actually uppercase in IRC)
  //
  // bots must identify themselves by prefixing or suffixing their
  // username with 'bot'.
  // http://en.wikipedia.org/wiki/Wikipedia:Bot_policy#Bot_accounts
  var flagsAndDiffUrl = messageComponents[0]
    .replace('[[' + article + ']] ', '')
    .split(' ');
  var flags = flagsAndDiffUrl[0];
  if (DISCARD_WIKIPEDIA_BOTS) {
    if (/B/.test(flags) || /\bbot/i.test(editor) || /bot\b/i.test(editor)) {
      return;
    }
  }
  // normalize article titles to follow the Wikipedia URLs
  article = article.replace(/\s/g, '_');
  // the language format follows the IRC room format: '#language.project'
  var language = to.substring(1, to.indexOf('.'));
  editor = language + ':' + editor;
  // diff URL
  var diffUrl = flagsAndDiffUrl[1];
  if (
    diffUrl &&
    diffUrl.indexOf('diff') !== -1 &&
    diffUrl.indexOf('oldid') !== -1
  ) {
    var toRev = diffUrl.replace(/.*\?diff=(\d+).*/, '$1');
    var fromRev = diffUrl.replace(/.*&oldid=(\d+).*/, '$1');
    if (language === 'wikidata') {
      diffUrl =
        'http://wikidata.org/w/api.php?action=compare&torev=' +
        toRev +
        '&fromrev=' +
        fromRev +
        '&format=json';
    } else {
      diffUrl =
        'http://' +
        language +
        '.wikipedia.org/w/api.php?action=compare&torev=' +
        toRev +
        '&fromrev=' +
        fromRev +
        '&format=json';
    }
  } else {
    diffUrl = '';
  }
  // delta
  var deltaAndCommentRegExp = /\(([+-]\d+)\)\s(.*?)$/;
  var delta = messageComponents[2].replace(deltaAndCommentRegExp, '$1');
  // comment
  var comment = messageComponents[2].replace(deltaAndCommentRegExp, '$2');
  // language cluster URL
  var languageClusterUrl;
  if (language === 'wikidata') {
    languageClusterUrl =
      'http://www.wikidata.org/w/api.php?' +
      'action=wbgetentities&props=sitelinks&format=json&ids=' +
      encodeURIComponent(article);
  } else {
    languageClusterUrl =
      'http://' +
      language +
      '.wikipedia.org/w/api.php?action=query&prop=langlinks' +
      '&format=json&lllimit=500&titles=' +
      encodeURIComponent(article);
  }
  return {
    article: article,
    editor: editor,
    language: language,
    delta: delta,
    comment: comment,
    diffUrl: diffUrl,
    languageClusterUrl: languageClusterUrl,
  };
}

function checkBreakingNewsConditions(article) {
  // (1) breaking news threshold
  var breakingNewsThresholdReached =
    article.occurrences >= BREAKING_NEWS_THRESHOLD;
  // (2) check interval distances between edits
  // if something is suspected to be breaking news, all interval
  // distances must be below a certain threshold
  var intervals = article.intervals;
  var allEditsInShortDistances = false;
  var index = 0;
  var intervalsLength = intervals.length;
  if (intervalsLength > BREAKING_NEWS_THRESHOLD - 1) {
    index = intervalsLength - BREAKING_NEWS_THRESHOLD + 1;
  }
  for (var i = index; i < intervalsLength; i++) {
    if (intervals[i] <= SECONDS_BETWEEN_EDITS * 1000) {
      allEditsInShortDistances = true;
    } else {
      allEditsInShortDistances = false;
      break;
    }
  }
  // (3) number of concurrent editors
  var numberOfEditors = article.editors.length;
  var numberOfEditorsReached = numberOfEditors >= NUMBER_OF_CONCURRENT_EDITORS;
  // if we have an article in more than one languge, check for the
  // normal NUMBER_OF_CONCURRENT_EDITORS
  if (Object.keys(article.languages).length > 1) {
    numberOfEditorsReached = numberOfEditors >= NUMBER_OF_CONCURRENT_EDITORS;
    // else if we have an article in just one languge, require the
    // triple NUMBER_OF_CONCURRENT_EDITORS
  } else {
    numberOfEditorsReached =
      numberOfEditors >= 3 * NUMBER_OF_CONCURRENT_EDITORS;
  }
  return {
    breakingNewsThresholdReached: breakingNewsThresholdReached,
    allEditsInShortDistances: allEditsInShortDistances,
    numberOfEditorsReached: numberOfEditorsReached,
  };
}

function monitorWikipedia() {
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    // discard canary events
    if (data.meta.domain === 'canary') {
      return;
    }
    if (data.type !== 'edit') {
      return;
    }
    if (data.bot) {
      return;
    }
    if (data.namespace !== 0) {
      return;
    }
    if (!WIKIPEDIAS.includes(data.server_name)) {
      return;
    }

    var article = data.title.replace(/\s/g, '_');
    var delta =
      data.length.new - data.length.old > 0
        ? '+' + (data.length.new - data.length.old)
        : data.length.new - data.length.old;
    var comment = data.comment;
    var language = data.wiki.replace(/wiki$/, '');
    var editor = language + ':' + data.user;
    var languageClusterUrl =
      'https://' +
      language +
      '.wikipedia.org/w/api.php?action=query&prop=langlinks' +
      '&format=json&lllimit=500&titles=' +
      encodeURIComponent(article);
    var diffUrl =
      language === 'wikidata'
        ? 'http://wikidata.org/w/api.php?action=compare&torev=' +
          data.revision.new +
          '&fromrev=' +
          data.revision.old +
          '&format=json'
        : 'http://' +
          language +
          '.wikipedia.org/w/api.php?action=compare&torev=' +
          data.revision.new +
          '&fromrev=' +
          data.revision.old +
          '&format=json';
    var now = Date.now();

    // get language references via the Wikipedia API
    article = language + ':' + article;
    request.get(
      {
        uri: languageClusterUrl,
        headers: { 'User-Agent': USER_AGENT },
      },
      function (error, response, body) {
        getLanguageReferences(error, response, body, article);
      }
    );

    // TODO
    // get out-links to other articles mentioned in the current article
    // http://en.wikipedia.org/w/api.php?action=query&prop=links&pllimit=500&format=json&titles=

    // TODO
    // get in-links to the current article
    // http://en.wikipedia.org/w/api.php?action=query&list=backlinks&bllimit=500&format=json&bltitle=

    // get the diff URL and check if we have notable or trivial changes
    if (diffUrl) {
      request.get(
        {
          uri: diffUrl,
          headers: { 'User-Agent': USER_AGENT },
        },
        function (error, response, body) {
          getDiffUrl(error, response, body, article, now);
        }
      );
    }

    // new article
    if (!articleVersionsMap[article]) {
      // self-reference to detect repeatedly edited single-language version
      // articles that do not have other language versions
      articleVersionsMap[article] = article;
      // store the first occurrence of the new article
      articles[article] = {
        timestamp: now,
        occurrences: 1,
        intervals: [],
        editors: [editor],
        languages: {},
        versions: {},
        changes: {},
      };
      articles[article].languages[language] = 1;
      articles[article].changes[now] = {
        diffUrl: diffUrl,
        delta: delta,
        language: language,
        editor: editor,
        comment: comment ? comment : '',
      };
      // reporting WebSockets
      if (USE_WEBSOCKETS) {
        io.sockets.emit('firstTimeSeen', {
          article: article,
          timestamp: new Date(articles[article].timestamp).toString(),
          editors: [editor],
          languages: articles[article].languages,
          versions: articles[article].versions,
        });
      }
      // reporting console
      if (VERBOUS && REALLY_VERBOUS) {
        console.log(
          '[ * ] First time seen: "' +
            article +
            '". ' +
            'Timestamp: ' +
            new Date(articles[article].timestamp) +
            '. ' +
            'Editors: ' +
            editor +
            '. ' +
            'Languages: ' +
            JSON.stringify(articles[article].languages)
        );
      }
      // existing article
    } else {
      var currentArticle = article;
      if (article !== articleVersionsMap[article]) {
        // reporting WebSockets
        if (USE_WEBSOCKETS) {
          io.sockets.emit('merging', {
            current: article,
            existing: articleVersionsMap[article],
            timestamp: new Date(now).toString(),
          });
        }
        // reporting console
        if (VERBOUS) {
          console.log(
            '[ ⚭ ] Merging ' + article + ' with ' + articleVersionsMap[article]
          );
        }
        article = articleVersionsMap[article];
      }
      // update statistics of the article
      if (articles[article]) {
        articles[article].occurrences += 1;
        articles[article].versions[currentArticle] = true;
        articles[article].intervals.push(now - articles[article].timestamp);
        articles[article].timestamp = now;
        articles[article].changes[now] = {
          diffUrl: diffUrl,
          delta: delta,
          language: language,
          editor: editor,
          comment: comment ? comment : '',
        };

        // we track editors by languages like so: lang:user. if the same user
        // edits an article in different languages, she is logged as
        // lang1:user and lang2:user, but we still consider them the same,
        // and add them like so: lang1,lang2:user.
        var editorPresent = false;
        var presentEditorIndex = 0;
        var currentEditor = editor.split(':')[1];
        for (var i = 0, l = articles[article].editors.length; i < l; i++) {
          if (currentEditor === articles[article].editors[i].split(':')[1]) {
            editorPresent = true;
            presentEditorIndex = i;
            break;
          }
        }
        if (!editorPresent) {
          articles[article].editors.push(editor);
        } else {
          var currentLanguages =
            articles[article].editors[presentEditorIndex].split(':')[0];
          if (currentLanguages.indexOf(language) === -1) {
            currentLanguages = language + ',' + currentLanguages;
          }
          articles[article].editors[presentEditorIndex] =
            currentLanguages + ':' + currentEditor;
        }
        if (articles[article].languages[language]) {
          articles[article].languages[language] += 1;
        } else {
          articles[article].languages[language] = 1;
        }
        // check the three breaking news conditions:
        var breakingNewsConditions = checkBreakingNewsConditions(
          articles[article]
        );

        // reporting WebSockets
        if (USE_WEBSOCKETS) {
          io.sockets.emit('nTimesSeen', {
            article: article,
            occurrences: articles[article].occurrences,
            timestamp: new Date(articles[article].timestamp).toString(),
            editIntervals: articles[article].intervals,
            editors: articles[article].editors,
            languages: articles[article].languages,
            versions: articles[article].versions,
            changes: articles[article].changes,
            conditions: {
              breakingNewsThreshold:
                breakingNewsConditions.breakingNewsThresholdReached,
              secondsBetweenEdits:
                breakingNewsConditions.allEditsInShortDistances,
              numberOfConcurrentEditors:
                breakingNewsConditions.numberOfEditorsReached,
            },
          });
        }
        // reporting console
        if (VERBOUS) {
          console.log(
            '[ ! ] ' +
              articles[article].occurrences +
              ' ' +
              'times seen: "' +
              article +
              '". ' +
              'Timestamp: ' +
              new Date(articles[article].timestamp) +
              '. Edit intervals: ' +
              articles[article].intervals
                .toString()
                .replace(/(\d+),?/g, '$1ms ')
                .trim() +
              '. ' +
              'Parallel editors: ' +
              articles[article].editors.length +
              '. Editors: ' +
              articles[article].editors +
              '. ' +
              'Languages: ' +
              JSON.stringify(articles[article].languages)
          );
        }

        // check if all three breaking news conditions are fulfilled at once
        if (
          breakingNewsConditions.breakingNewsThresholdReached &&
          breakingNewsConditions.allEditsInShortDistances &&
          breakingNewsConditions.numberOfEditorsReached
        ) {
          // search for all article titles in social networks
          var searchTerms = {};
          // use the article title as search term
          searchTerms[article.split(':')[1].replace(/_/g, ' ')] = true;
          for (var key in articles[article].versions) {
            // use the article title as search term
            var articleTitle = key.split(':')[1].replace(/_/g, ' ');
            if (!searchTerms[articleTitle]) {
              searchTerms[articleTitle] = true;
            }
          }
          var wikipediaUrl = createWikipediaUrl(articleVersionsMap[article]);
          /*
          illustrator(searchTerms, wikipediaUrl, function(mediaGalleryHtml) {
            socialNetworkSearch(searchTerms, function(socialNetworksResults) {
              if (USE_WEBSOCKETS) {
                if (articles[article]) {
                  io.sockets.emit('breakingNewsCandidate', {
                    article: article,
                    occurrences: articles[article].occurrences,
                    timestamp: new Date(articles[article].timestamp).toString(),
                    editIntervals: articles[article].intervals,
                    editors: articles[article].editors,
                    languages: articles[article].languages,
                    versions: articles[article].versions,
                    changes: articles[article].changes,
                    conditions: {
                      breakingNewsThreshold:
                          breakingNewsConditions.breakingNewsThresholdReached,
                      secondsBetweenEdits:
                          breakingNewsConditions.allEditsInShortDistances,
                      numberOfConcurrentEditors:
                          breakingNewsConditions.numberOfEditorsReached
                    },
                    mediaGalleryHtml: mediaGalleryHtml,
                    socialNetworksResults: socialNetworksResults
                  });

                  if (EMAIL_BREAKING_NEWS_CANDIDATES) {
                    email(articleVersionsMap[article], wikipediaUrl,
                        socialNetworksResults);
                  }
                  // reporting console
                  if (VERBOUS) {
                    console.log('[ ★ ] Breaking news candidate: "' +
                        article + '". ' +
                        articles[article].occurrences + ' ' +
                        'times seen. ' +
                        'Timestamp: ' +
                        new Date(articles[article].timestamp) +
                        '. Edit intervals: ' +
                        articles[article].intervals.toString()
                        .replace(/(\d+),?/g, '$1ms ').trim() + '. ' +
                        'Number of editors: ' +
                        articles[article].editors.length + '. ' +
                        'Editors: ' + articles[article].editors + '. ' +
                        'Languages: ' +
                        JSON.stringify(articles[article].languages));
                  }
                }
              }
            });
          });
          */
        }
      }
    }
  };
}

// retrieves the diff URL of an article and stores the cleaned diff text
function getDiffUrl(error, response, body, article, now) {
  if (!error) {
    var json;
    try {
      json = JSON.parse(body);
    } catch (e) {
      json = false;
    }
    if (
      json &&
      json.compare &&
      json.compare['*'] &&
      articles[article] &&
      articles[article].changes[now]
    ) {
      var parsedHtml = $.load(json.compare['*']);
      var addedLines = parsedHtml('.diff-addedline');
      var diffTexts = [];
      var diffConcepts = [];
      addedLines.each(function () {
        var text = $(this).text().trim();
        var concepts = extractWikiConcepts(
          text,
          articles[article].changes[now].language
        );
        if (concepts) {
          diffConcepts.concat(concepts);
        }
        text = removeWikiNoise(text);
        text = removeWikiMarkup(text);
        if (text) {
          diffTexts.push(text);
        }
      });
      articles[article].changes[now].diffTexts = diffTexts;
      articles[article].changes[now].namedEntities = diffConcepts;
    }
  } else {
    console.error(
      'Wikipedia API error while getting diff text.' +
        (response ? ' Status Code: ' + response.statusCode : '') +
        (error ? ' Error message: ' + error : '')
    );
  }
}

// removes HTML tags from text (like the PHP function with the same name)
function strip_tags(input, allowed) {
  // making sure the allowed arg is a string containing only tags in lowercase
  // (<a><b><c>)
  allowed = (
    ((allowed || '') + '').toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []
  ).join('');
  var tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi,
    commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi;
  return input.replace(commentsAndPhpTags, '').replace(tags, function ($0, $1) {
    return allowed.indexOf('<' + $1.toLowerCase() + '>') > -1 ? $0 : '';
  });
}

// extracts Wikipedia concepts (i.e., links to other articles)
function extractWikiConcepts(text, language) {
  var concepts = [];
  text = text.replace(/\[\[(.*?)\]\]/g, function (m, l) {
    var p = l.split(/\|/);
    var link = p.shift();

    if (link.match(/^Image:(.*)/)) {
      return false;
    }
    if (link.indexOf(':') === -1) {
      concepts.push(language + ':' + link.replace(/\s/g, '_'));
    } else {
      concepts.push(link.replace(/\s/g, '_'));
    }
  });
  return concepts;
}

// removes noise from the diff text of article edits
function removeWikiNoise(text) {
  // remove things like [[Kategorie:Moravske Toplice| Moravske Toplice]]
  var namespaceNoiseRegEx = /\[\[.*?\:.*?\]\]/g;
  // remove things like {{NewZealand-writer-stub}}
  var commentNoiseRegEx = /\{\{.*?\}\}/g;
  // remove things like align="center"
  var htmlAttributeRegEx = /\w+\s*\=\s*\"\w+\"/g;
  // remove things like {{
  var openingCommentParenthesisRegEx = /\{\{/g;
  // remove things like }}
  var closingCommentParenthesisRegEx = /\}\}/g;
  text = text
    .replace(namespaceNoiseRegEx, '')
    .replace(commentNoiseRegEx, ' ')
    .replace(htmlAttributeRegEx, ' ')
    .replace(openingCommentParenthesisRegEx, ' ')
    .replace(closingCommentParenthesisRegEx, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  text = strip_tags(text);
  return text;
}

// removes wiki markup from the diff text of article edits
function removeWikiMarkup(text) {
  var tableMarkupRegEx = /\|/g;
  text = strip_tags(wiki2html(text));
  text = text
    .replace(tableMarkupRegEx, ' ')
    .replace(/\[\[/g, ' ')
    .replace(/\]\]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s?=\s?/g, ' = ')
    .trim();
  return text;
}

// callback function for getting language references from the Wikipedia API
// for an article
function getLanguageReferences(error, response, body, article) {
  // helper function to insert language versions
  var insertArticle = function (language, title) {
    if (
      (MONITOR_SHORT_TAIL_WIKIPEDIAS &&
        wikipedias.millionPlusLanguages[language]) ||
      (MONITOR_LONG_TAIL_WIKIPEDIAS &&
        wikipedias.oneHundredThousandPlusLanguages[language]) ||
      (MONITOR_REALLY_LONG_TAIL_WIKIPEDIAS &&
        wikipedias.reallyLongTailWikipedias[language])
    ) {
      var articleVersion = language + ':' + title;
      articleClusters[article][articleVersion] = true;
      articleVersionsMap[articleVersion] = article;
    }
  };

  if (!error && response.statusCode == 200) {
    var json;
    try {
      json = JSON.parse(body);
    } catch (e) {
      json = false;
    }
    if (json) {
      var language = article.split(':')[0];
      if (!articleClusters[article]) {
        articleClusters[article] = {};
      }
      if (language === 'wikidata') {
        var wikidataId = article.split(':')[1].toLowerCase();
        if (
          json.entities &&
          json.entities[wikidataId] &&
          json.entities[wikidataId].sitelinks
        ) {
          var sitelinks = json.entities[wikidataId].sitelinks;
          for (var languageWiki in sitelinks) {
            var language = languageWiki.replace(/wiki$/, '');
            var title = sitelinks[languageWiki].title.replace(/\s/g, '_');
            insertArticle(language, title);
          }
        }
      } else {
        if (json.query && json.query.pages) {
          var pages = json.query.pages;
          for (var id in pages) {
            var page = pages[id];
            if (page.langlinks) {
              page.langlinks.forEach(function (langLink) {
                var language = langLink.lang;
                var title = langLink['*'].replace(/\s/g, '_');
                insertArticle(language, title);
              });
            }
          }
        }
      }
    }
  } else {
    console.error(
      'Wikipedia API error while getting language references.' +
        (response ? ' Status Code: ' + response.statusCode : '') +
        (error ? ' Error message: ' + error : '')
    );
  }
}

// setting up the Web Socket-based communication with the front-end
if (USE_WEBSOCKETS) {
  io.sockets.on('connection', function (socket) {
    // send the default settings
    socket.emit('defaultSettings', {
      secondsSinceLastEdit: SECONDS_SINCE_LAST_EDIT,
      secondsBetweenEdits: SECONDS_BETWEEN_EDITS,
      breakingNewsThreshold: BREAKING_NEWS_THRESHOLD,
      numberOfConcurrentEditors: NUMBER_OF_CONCURRENT_EDITORS,
    });

    // react on settings changes
    socket.on('secondsSinceLastEdit', function (data) {
      SECONDS_SINCE_LAST_EDIT = data.value;
      console.log(
        'Setting SECONDS_SINCE_LAST_EDIT to: ' + SECONDS_SINCE_LAST_EDIT
      );
    });
    socket.on('secondsBetweenEdits', function (data) {
      SECONDS_BETWEEN_EDITS = data.value;
      console.log('Setting SECONDS_BETWEEN_EDITS to: ' + SECONDS_BETWEEN_EDITS);
    });
    socket.on('breakingNewsThreshold', function (data) {
      BREAKING_NEWS_THRESHOLD = data.value;
      console.log(
        'Setting BREAKING_NEWS_THRESHOLD to: ' + BREAKING_NEWS_THRESHOLD
      );
    });
    socket.on('numberOfConcurrentEditors', function (data) {
      NUMBER_OF_CONCURRENT_EDITORS = data.value;
      console.log(
        'Setting NUMBER_OF_CONCURRENT_EDITORS to: ' +
          NUMBER_OF_CONCURRENT_EDITORS
      );
    });
  });
}

// clean-up function, called regularly like a garbage collector
function cleanUpMonitoringLoop() {
  for (var key in articles) {
    var now = Date.now();
    if (now - articles[key].timestamp > SECONDS_SINCE_LAST_EDIT * 1000) {
      delete articles[key];
      for (var version in articleClusters[key]) {
        delete articleVersionsMap[version];
      }
      delete articleClusters[key];
      delete articleVersionsMap[key];
      if (VERBOUS && REALLY_VERBOUS) {
        console.log(
          '[ † ] No more mentions: "' +
            key +
            '". ' +
            'Article clusters left: ' +
            Object.keys(articleClusters).length +
            '. ' +
            'Mappings left: ' +
            Object.keys(articleVersionsMap).length
        );
      }
    }
  }
  if (USE_WEBSOCKETS) {
    io.sockets.emit('stats', {
      clustersLeft: Object.keys(articleClusters).length,
    });
  }
}

function createWikipediaUrl(article) {
  var components = article.split(':');
  if (components[0] === 'wikidata') {
    return (
      'http://' +
      components[0] +
      '.org/wiki/' +
      encodeURIComponent(components[1])
    );
  } else {
    return (
      'http://' +
      components[0] +
      '.wikipedia.org/wiki/' +
      encodeURIComponent(components[1])
    );
  }
}

function email(article, wikipediaUrl, microposts) {
  // if we have already emailed the current URL, don't email it again
  if (recentEmailsBuffer.indexOf(wikipediaUrl) !== -1) {
    console.log('Already emailed about ' + wikipediaUrl);
    return;
  }
  // keep the recent emails buffer at most 10 elements long
  recentEmailsBuffer.push(wikipediaUrl);
  if (recentEmailsBuffer.length > 10) {
    recentEmailsBuffer.shift();
  }

  var generateHtmlMail = function () {
    var preg_quote = function (str, delimiter) {
      // http://kevin.vanzonneveld.net
      // +   original by: booeyOH
      // +   improved by: Ates Goral (http://magnetiq.com)
      // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
      // +   bugfixed by: Onno Marsman
      // +   improved by: Brett Zamir (http://brett-zamir.me)
      // *     example 1: preg_quote("$40");
      // *     returns 1: '\$40'
      // *     example 2: preg_quote("*RRRING* Hello?");
      // *     returns 2: '\*RRRING\* Hello\?'
      // *     example 3: preg_quote("\\.+*?[^]$(){}=!<>|:");
      // *     returns 3: '\\\.\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:'
      return (str + '').replace(
        new RegExp(
          '[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\' + (delimiter || '') + '-]',
          'g'
        ),
        '\\$&'
      );
    };

    // converts a user name like en:Jon_Doe to a valid Wikipedia user profile
    // link like so: http://en.wikipedia.org/wiki/User:Jon_Doe. Ignore
    // anonymous users
    var linkifyEditor = function (user) {
      var components = user.split(':');

      IP_V4.lastIndex = 0;
      IP_V6.lastIndex = 0;
      if (IP_V4.test(user) || IP_V6.test(user)) {
        return '<a class="user">' + components[1] + '</a>';
      }
      return (
        '<a class="user" href="http://' +
        components[0].replace(/(\w+),.*/, '$1') +
        '.wikipedia.org/wiki/User:' +
        components[1] +
        '">' +
        components[1] +
        '</a>'
      );
    };

    var imgUrl =
      'https://raw.github.com/tomayac/wikipedia-live-monitor/master/static/';
    var html = '';
    var image = '<img src="' + imgUrl + article.split(':')[0] + '.png">';
    html +=
      '<h1 style="font-size: 1.2em;">Breaking News Candidate<br><nobr>' +
      image +
      ' <a href="' +
      wikipediaUrl +
      '">' +
      decodeURIComponent(wikipediaUrl) +
      '</a></nobr></h1>';
    html += '<h2 style="font-size: 1.0em;">All Language Versions</h2>';
    if (Object.keys(articles[article].versions).length) {
      html += '<ul>';
      for (var version in articles[article].versions) {
        var url = createWikipediaUrl(version);
        html +=
          '<li>' +
          '<nobr><img src="' +
          imgUrl +
          version.split(':')[0] +
          '.png"> <a href="' +
          url +
          '">' +
          decodeURIComponent(url) +
          '</a>' +
          '</nobr></li>';
      }
      html += '</ul>';
    }
    html += '<h2 style="font-size: 1.0em;">Last Edits</h2><ul>';
    for (var timestamp in articles[article].changes) {
      var change = articles[article].changes[timestamp];
      html +=
        '<li><nobr><img src="' +
        imgUrl +
        change.language +
        '.png"> ' +
        linkifyEditor(change.editor) +
        ': ' +
        '</nobr><span style="font-style: italic; font-size: 0.8em;">' +
        (change.comment ? change.comment : 'N/A') +
        '</span> ' +
        '(<a href="' +
        change.diffUrl +
        '"><span style="' +
        (change.delta.indexOf('+') === -1 ? 'color:red;' : 'color:green;') +
        '">' +
        change.delta +
        '</span></a>) ';
      if (change.diffTexts) {
        html += '<ul>';
        change.diffTexts.forEach(function (diffText) {
          html +=
            '<li><span style="font-style: italic; font-size: 0.8em; ' +
            'color: gray;">' +
            diffText +
            '</span>';
        });
        html += '</ul>';
      }
    }
    html += '</ul>';
    var socialHtml = '';
    if (microposts) {
      var now = Date.now();
      for (var term in microposts) {
        // only append the term if microposts exist. need to iterate over all
        // networks and check the freshness. ugly, but works.
        var resultsExistForTerm = false;
        for (var network in microposts[term]) {
          if (Array.isArray(microposts[term][network])) {
            microposts[term][network].forEach(function (item) {
              // not older than 1h: 1 * 60 * 60 * 1000 = 3600000
              if (now - item.timestamp < 3600000) {
                resultsExistForTerm = true;
              }
            });
          }
        }
        if (resultsExistForTerm) {
          socialHtml += '<li><b>' + term + '</b>';
        }
        for (var network in microposts[term]) {
          if (Array.isArray(microposts[term][network])) {
            microposts[term][network].forEach(function (item) {
              // not older than 1h: 1 * 60 * 60 * 1000 = 3600000
              if (now - item.timestamp < 3600000) {
                var micropost = item.micropost;
                if (micropost.length > 280) {
                  micropost = micropost.substring(0, 280) + ' […]';
                }
                socialHtml +=
                  '<br/><img style="width: 16px; height: 16px; ' +
                  'border-radius: 5px; vertical-align: middle;" src="' +
                  item.avatar +
                  '"/> ' +
                  '<img style="width: 16px; height: 16px; ' +
                  'border-radius: 5px; vertical-align: middle;" src="' +
                  imgUrl +
                  network.toLowerCase() +
                  '.png"/> <small> ' +
                  '<a href="' +
                  item.profileLink +
                  '">' +
                  item.user +
                  '</a> (<a href="' +
                  item.deepLink +
                  '">' +
                  new Date(item.timestamp).toString().substring(0, 24) +
                  '</span></a>): ' +
                  micropost.replace(
                    new RegExp('(' + preg_quote(term) + ')', 'gi'),
                    '<span style="background-color: yellow;">$1</span>'
                  ) +
                  '</small>';
              }
            });
          }
        }
        if (resultsExistForTerm) {
          socialHtml += '</li>';
        }
      }
    }
    if (socialHtml) {
      html +=
        '<h2 style="font-size: 1.0em;">Social Network Coverage</h2><ul>' +
        socialHtml +
        '</ul>';
    }
    return html;
  };

  // setup e-mail data with unicode symbols
  var mailOptions = {
    from: 'Wikipedia Live Monitor <' + process.env.EMAIL_ADDRESS + '>',
    to: process.env.EMAIL_RECEIVER,
    subject: 'Breaking News Candidate: ' + decodeURIComponent(wikipediaUrl),
    generateTextFromHTML: true,
    forceEmbeddedImages: true,
    html: generateHtmlMail(),
  };
  // send mail with defined transport object
  smtpTransport.sendMail(mailOptions, function (error, response) {
    if (error) {
      console.error(error);
    } else {
      console.log('Message sent: ' + response.message);
      // https://groups.google.com/forum/feed/wikipedialivemonitor/msgs/atom.xml?num=15
    }
  });
}

// start static serving
// and set default route to index.html
app.use(express.static(__dirname + '/static'));
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

// start garbage collector
setInterval(function () {
  cleanUpMonitoringLoop();
}, 10 * 1000);

// start the monitoring process upon a connection
monitorWikipedia();

// start the server
var port = process.env.PORT || 8080;
console.log('Wikipedia Live Monitor running on port ' + port);
server.listen(port);
