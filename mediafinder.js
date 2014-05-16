'use strict';

var querystring = require('querystring');
var request = require('request');
var jsdom = require('jsdom');
var pos = require('pos');
var URL = require('url');
var Step = require('./step.js');
var twitter = require('node-twitter');
var env = require('node-env-file');
env(__dirname + '/.env');

var GLOBAL_config = {
  DEBUG: true,
  TRANSLATE: false,
  PART_OF_SPEECH: false,
  NAMED_ENTITY_EXTRACTION: false,
  USE_GOOGLE_RESEARCH_API: false,
  MOBYPICTURE_KEY: process.env.MOBYPICTURE_KEY,
  FLICKR_SECRET: process.env.FLICKR_SECRET,
  FLICKR_KEY: process.env.FLICKR_KEY,
  YFROG_KEY: process.env.YFROG_KEY,
  INSTAGRAM_KEY: process.env.INSTAGRAM_KEY,
  INSTAGRAM_SECRET: process.env.INSTAGRAM_SECRET,
  GOOGLE_KEY: process.env.GOOGLE_KEY,
  GOOGLE_RESEARCH_API_KEY: process.env.GOOGLE_RESEARCH_API_KEY,
  IMGUR_KEY: process.env.IMGUR_KEY,
  TWITTER_CONSUMER_KEY: process.env.TWITTER_CONSUMER_KEY,
  TWITTER_CONSUMER_SECRET: process.env.TWITTER_CONSUMER_SECRET,
  TWITTER_ACCESS_TOKEN_KEY: process.env.TWITTER_ACCESS_TOKEN_KEY,
  TWITTER_ACCESS_TOKEN_SECRET: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET,
  HEADERS: {
    'Accept': 'application/json, text/javascript, */*',
    'Accept-Charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3',
    'Accept-Language': 'en-US,en;q=0.8,fr-FR;q=0.6,fr;q=0.4,de;q=0.2,de-DE;' +
        'q=0.2,es;q=0.2,ca;q=0.2',
    'Connection': 'keep-alive',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Referer': 'http://www.google.com/',
    'User-Agent': null
  },
  MEDIA_PLATFORMS: [
    'yfrog.com',
    'instagr.am',
    'instagram.com',
    'flic.kr',
    'flickr.com',
    'moby.to',
    'youtu.be',
    'youtube.com',
    'twitpic.com',
    'picplz.com',
    'qik.com',
    'ustre.am',
    'twitvid.com',
    'photobucket.com',
    'pic.twitter.com',
    'i.imgur.com',
    'picasaweb.google.com',
    'twitgoo.com',
    'vimeo.com',
    'img.ly',
    'mypict.me',
    'vine.co'
  ],
  /* jshint maxlen:false */
  URL_REGEX: /\b((?:[a-z][\w\-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/ig,
  INSTAGRAM_REGEX: /[^0-9A-Za-z\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0\u08A2-\u08AC\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097F\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191C\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2183\u2184\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005\u3006\u3031-\u3035\u303B\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA697\uA6A0-\uA6E5\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA793\uA7A0-\uA7AA\uA7F8-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA80-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]/g,
  /* jshint maxlen:80 */
  HASHTAG_REGEX: /(^|\s)\#(\S+)/g,
  USER_REGEX: /(^|\W)\@([a-zA-Z0-9_]+)/g,
  PLUS_REGEX: /(^|\W)\+([a-zA-Z0-9_]+)/g,
  TAG_REGEX: /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi
};

var twit = new twitter.SearchClient(
  GLOBAL_config.TWITTER_CONSUMER_KEY,
  GLOBAL_config.TWITTER_CONSUMER_SECRET,
  GLOBAL_config.TWITTER_ACCESS_TOKEN_KEY,
  GLOBAL_config.TWITTER_ACCESS_TOKEN_SECRET
);

var mediaFinder = {
  search: function search(service, query, userAgent, callback) {
    GLOBAL_config.HEADERS['User-Agent'] = userAgent;
    /**
     * From https://developer.mozilla.org/en/JavaScript/Reference/Global_-
     * Objects/Date#Example:_ISO_8601_formatted_dates
     */
    function getIsoDateString(d) {
      function pad(n) { return n < 10 ? '0' + n : n; }
      d = new Date(d);
      return d.getUTCFullYear() + '-' +
          pad(d.getUTCMonth() + 1) + '-' +
          pad(d.getUTCDate()) + 'T' +
          pad(d.getUTCHours()) + ':' +
          pad(d.getUTCMinutes()) + ':' +
          pad(d.getUTCSeconds()) + 'Z';
    }

    /**
     * Cleans video URLs, tries to convert YouTube URLS to HTML5 versions
     * Core bits adapted from https://github.com/endlesshack/youtube-video
     */
    function cleanVideoUrl(url, callback) {

      var decodeQueryString = function(queryString) {
        var key, keyValPair, keyValPairs, r, val, _i, _len;
        r = {};
        keyValPairs = queryString.split('&');
        for (_i = 0, _len = keyValPairs.length; _i < _len; _i++) {
          keyValPair = keyValPairs[_i];
          key = decodeURIComponent(keyValPair.split('=')[0]);
          val = decodeURIComponent(keyValPair.split('=')[1] || '');
          r[key] = val;
        }
        return r;
      };

      var decodeStreamMap = function(url_encoded_fmt_stream_map) {
        var quality, sources, stream, type, urlEncodedStream, _i, _len, _ref;
        sources = {};
        _ref = url_encoded_fmt_stream_map.split(',');
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          urlEncodedStream = _ref[_i];
          if (!urlEncodedStream) {
            return false;
          }
          stream = decodeQueryString(urlEncodedStream);
          type = stream.type.split(';')[0];
          quality = stream.quality.split(',')[0];
          stream.original_url = stream.url;
          stream.url = '' + stream.url + '&signature=' + stream.sig;
          sources['' + type + ' ' + quality] = stream;
        }
        return sources;
      };

      // Possible URL patterns
      // http://www.youtube.com/v/WnszesKUXp8
      // http://www.youtube.com/watch?v=EVBsypHzF3U
      // http://www.youtube.com/watch?v=-qzRe325AQU&feature=youtube_gdata_player
      // http://youtu.be/EVBsypHzF3U
      var extractYouTubeVideoId = function(url) {
        var urlObj = URL.parse(url);
        var pathComponents = urlObj.pathname.split(/\//g);
        var videoId;
        if (pathComponents[1] === 'v') {
          videoId = pathComponents[2];
        } else if (pathComponents[1] === 'watch') {
          var query = urlObj.query;
          query.split(/&/g).forEach(function(param) {
            var keyValue = param.split(/=/);
            if (keyValue[0] === 'v') {
              videoId = keyValue[1];
            }
          });
        } else {
          videoId = pathComponents[1];
        }
        return videoId;
      };

      // if is YouTube URL
      if ((url.indexOf('http://www.youtube.com') === 0) ||
          (url.indexOf('https://www.youtube.com') === 0) ||
          (url.indexOf('http://youtu.be') === 0)) {
        try {
          var videoId = extractYouTubeVideoId(url);
          // Translate to HTML5 video URL, try at least
          var options = {
            headers: {
              'User-Agent': GLOBAL_config.HEADERS['User-Agent']
            },
            url: 'http://www.youtube.com/get_video_info?video_id=' + videoId
          };
          request.get(options, function(err, reply, body) {
            var video;
            if (!body) {
              return callback(url);
            }
            video = decodeQueryString(body);
            // video.live_playback is '1' for Hangouts on Air
            if (video.status === 'fail' || video.live_playback) {
              return callback(url);
            }
            if (!video.url_encoded_fmt_stream_map) {
              return callback(url);
            }
            video.sources = decodeStreamMap(video.url_encoded_fmt_stream_map);
            if (!video.sources) {
              return callback(url);
            }
            video.getSource = function(type, quality) {
              var exact, key, lowest, source, _ref;
              lowest = null;
              exact = null;
              _ref = this.sources;
              for (key in _ref) {
                source = _ref[key];
                if (source.type.match(type)) {
                  if (source.quality.match(quality)) {
                    exact = source;
                  } else {
                    lowest = source;
                  }
                }
              }
              return exact || lowest;
            };
            var webm = video.getSource('video/webm', 'medium');
            var mp4 =  video.getSource('video/mp4', 'medium');
            if (webm) {
              return callback(webm.url, videoId);
            } else if (mp4) {
              return callback(mp4.url, videoId);
            } else {
              return callback(url, videoId);
            }
          });
        } catch(e) {
          callback(url);
        }
      } else {
        callback(url);
      }
    }

    /**
     * Replaces HTML entities
     */
    function replaceHtmlEntities(micropost) {
      micropost = micropost.replace(/&quot;/gi, '\"');
      micropost = micropost.replace(/&apos;/gi, '\'');
      micropost = micropost.replace(/&#39;/gi, '\'');
      micropost = micropost.replace(/&amp;/gi, '&');
      micropost = micropost.replace(/&gt;/gi, '>');
      micropost = micropost.replace(/&lt;/gi, '<');
      return micropost;
    }

    /**
     * Removes line breaks, double spaces, HTML tags, HTML entities, etc.
     */
    function cleanMicropost(micropost) {

      function strip_tags(input, allowed) {
        // making sure the allowed arg is a string containing only tags in
        // lowercase (<a><b><c>)
        allowed = (((allowed || '') + '').toLowerCase()
            .match(/<[a-z][a-z0-9]*>/g) || []).join('');
        var tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi,
          commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi;
        return input.replace(commentsAndPhpTags, '').replace(tags,
            function($0, $1) {
          return allowed.indexOf('<' + $1.toLowerCase() + '>') > -1 ? $0 : '';
        });
      }

      if (micropost) {
        // replace HTML entities
        micropost = replaceHtmlEntities(micropost);
        // remove HTML tags. regular expression stolen from
        var cleanedMicropost = strip_tags(micropost);
        //all regular expressions below stolen from
        // https://raw.github.com/cramforce/streamie/master/public/lib/stream/-
        // streamplugins.js
        //
        // remove urls
        cleanedMicropost = cleanedMicropost
            .replace(GLOBAL_config.URL_REGEX, ' ');
        // simplify #hashtags to hashtags
        cleanedMicropost = cleanedMicropost
            .replace(GLOBAL_config.HASHTAG_REGEX, ' $2');
        // simplify @username to username
        cleanedMicropost = cleanedMicropost
            .replace(GLOBAL_config.USER_REGEX, ' $2');
        // simplify +username to username
        cleanedMicropost = cleanedMicropost
            .replace(GLOBAL_config.PLUS_REGEX, ' $2');
        // replace line feeds and duplicate spaces
        micropost = micropost.replace(/[\n\r\t]/gi, ' ').replace(/\s+/g, ' ');
        cleanedMicropost = cleanedMicropost
            .replace(/[\n\r\t]/gi, ' ').replace(/\s+/g, ' ');
        return {
          html: micropost.trim(),
          plainText: cleanedMicropost.trim()
        };
      } else {
        return {
          html: '',
          plainText: ''
        };
      }
    }

    /**
     * Scrapes Vine
     */
    function scrapeVine(body, callback) {
      var mediaUrl = false;
      var posterUrl = false;
      if (!body) {
        callback(false);
      }
      try {
        jsdom.env(body, function(errors, window) {
          if (errors) {
            return callback(false);
          }
          var $ = window.document;
          try {
            var metas = $.getElementsByTagName('META');
            if (metas.length > 0) {
              for (var i = 0, len = metas.length; i < len; i++) {
                var meta = metas[i];
                if (meta.getAttribute('property') === 'twitter:image') {
                  posterUrl = meta.getAttribute('content');
                }
                if (meta.getAttribute('property') === 'twitter:player:stream') {
                  mediaUrl = meta.getAttribute('content');
                }
              }
            }
            if (posterUrl && mediaUrl) {
              callback(mediaUrl, posterUrl);
            } else {
              callback(false);
            }
          } catch(e) {
            callback(false);
          }
        });
      } catch(e) {
        callback(false);
      }
    }

    /**
     * Scrapes TwitPic
     */
    function scrapeTwitPic(body, callback) {
      var mediaUrl = false;
      var type = false;
      if (!body) {
        callback(false);
      }
      try {
        jsdom.env(body, function(errors, window) {
          if (errors) {
            return callback(false);
          }
          var $ = window.document;
          try {
            if ($.getElementsByTagName('VIDEO').length > 0) {
              mediaUrl = body.substring(body.indexOf('<source src="') +
                  ('<source src="'.length));
              mediaUrl = mediaUrl.substring(0, mediaUrl.indexOf('"'));
              type = 'video';
            } else {
              mediaUrl = $.getElementsByTagName('IMG')[1].src;
              type = 'photo';
            }
            callback(mediaUrl, type);
          } catch(e) {
            if (body.indexOf('error') === -1) {
              throw('ERROR: TwitPic screen scraper broken');
            }
            callback(false);
          }
        });
      } catch(e) {
        callback(false);
      }
    }

    /**
     * Scrapes img.ly
     */
    function scrapeImgLy(body, callback) {
      var mediaUrl = false;
      if (!body) {
        callback(false);
      }
      try {
        jsdom.env(body, function(errors, window) {
          if (errors) {
            return callback(false);
          }
          var $ = window.document;
          var match = 'the-image';
          try {
            var image = $.getElementById(match);
            if (image) {
              mediaUrl = image.src;
              callback(mediaUrl);
            } else {
              callback(false);
            }
          } catch(e) {
            throw('ERROR: img.ly screen scraper broken');
          }
        });
      } catch(e) {
        callback(false);
      }
    }

    /**
     * Annotates microposts with DBpedia Spotlight
     */
    function spotlight(json) {
      if (!GLOBAL_config.NAMED_ENTITY_EXTRACTION) {
        return sendResults(json);
      }
      if (GLOBAL_config.DEBUG) { console.log('spotlight'); }
      var currentService = 'DBpediaSpotlight';
      var options = {
        headers: {
          'Accept': 'application/json'
        },
        body: ''
      };
      var collector = {};
      var httpMethod = 'POST'; // 'GET';
      options.method = httpMethod;
      Step(
        function() {
          var group = this.group();
          var services = typeof json === 'object' ? Object.keys(json) : [];
          services.forEach(function(serviceName) {
            var service = json[serviceName] || [];
            collector[serviceName] = [];
            service.forEach(function(item, i) {
              var text;
              if ((item.micropost.translation) &&
                  (item.micropost.translation.text) &&
                  (item.micropost.translation.language !== 'en')) {
                // for non-English texts, use the translation if it exists
                text = item.micropost.translation.text;
              } else {
                // use the original version
                text = item.micropost.clean;
              }
              if (httpMethod === 'POST') {
                options.headers['Content-Type'] =
                    'application/x-www-form-urlencoded; charset=UTF-8';
                // non-testing env:
                // 'http://spotlight.dbpedia.org/rest/annotate';
                options.url = 'http://spotlight.dbpedia.org/dev/rest/annotate';
                options.body =
                    'text=' + encodeURIComponent(text) +
                    '&confidence=0.2&support=20';
              } else {
                // non-testing env:
                // 'http://spotlight.dbpedia.org/rest/annotate' +
                options.url = 'http://spotlight.dbpedia.org/dev/rest/annotate' +
                    '?text=' + encodeURIComponent(text) +
                    '&confidence=0.2&support=20';
              }
              var cb = group();
              request(options, function(err, res, body) {
                if (!err && res.statusCode === 200) {
                  var response;
                  try {
                    response = JSON.parse(body);
                  } catch(e) {
                    // error
                    collector[serviceName][i] = [];
                    return cb(null);
                  }
                  if (response.Error || !response.Resources) {
                    // error
                    collector[serviceName][i] = [];
                    return cb(null);
                  }
                  var entities = [];
                  if (response.Resources) {
                    var uris = {};
                    var resources = response.Resources;
                    for (var j = 0, len = resources.length; j < len; j++) {
                      var entity = resources[j];
                      // the value of entity['@URI'] is not unique, but we only
                      // need it once, we simply don't care about the other
                      // occurrences
                      var currentUri = entity['@URI'];
                      if (!uris[currentUri]) {
                        uris[currentUri] = true;
                        entities.push({
                          name: entity['@surfaceForm'],
                          relevance: parseFloat(entity['@similarityScore']),
                          uris: [{
                            uri: currentUri,
                            source: currentService
                          }],
                          source: currentService
                        });
                      }
                    }
                  }
                  // success
                  collector[serviceName][i] = entities;
                } else {
                  // error
                  collector[serviceName][i] = [];
                }
                cb(null);
              });
            });
          });
        },
        function() {
          var services = typeof json === 'object' ? Object.keys(json) : [];
          services.forEach(function(serviceName) {
            var service = json[serviceName] || [];
            service.forEach(function(item, i) {
              item.micropost.entities = collector[serviceName][i];
              // part of speech tagging, PoS
              if (GLOBAL_config.PART_OF_SPEECH) {
                var words;
                if ((item.micropost.translation) &&
                    (item.micropost.translation.text) &&
                    (item.micropost.translation.language !== 'en')) {
                  // for non-English texts, use the translation if it exists
                  words = new pos.Lexer().lex(item.micropost.translation.text);
                } else {
                  words = new pos.Lexer().lex(item.micropost.clean);
                }
                var taggedWords = new pos.POSTagger().tag(words);
                var result = [];
                for (var j = 0, len = taggedWords.length; j < len; j++) {
                  var taggedWord = taggedWords[j];
                  // for all recognized noun types
                  if ((taggedWord[1] === 'NNS') ||
                      (taggedWord[1] === 'NNPS') ||
                      (taggedWord[1] === 'NNP')) {
                    var word = taggedWord[0];
                    var tag = taggedWord[2];
                    result.push({
                      word: word.toLowerCase(),
                      tag: tag
                    });
                  }
                  item.micropost.nouns = result;
                }
              }
            });
          });
          sendResults(json);
        }
      );
    }

    /**
     * Translates microposts one by one
     */
    function translate(json) {
      if (GLOBAL_config.DEBUG) { console.log('translate'); }
      var options;
      if (GLOBAL_config.USE_GOOGLE_RESEARCH_API) {
        /*
        options = {
          headers: {
            'X-HTTP-Method-Override': 'GET',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Authorization': 'GoogleLogin auth=' +
                GLOBAL_config.GOOGLE_RESEARCH_API_KEY
          },
          method: 'POST',
          url: 'http://translate.google.com/researchapi/translate',
          body: 'tl=en'
        };
        */
        options = {
          headers: {
            'X-HTTP-Method-Override': 'GET',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Authorization': 'GoogleLogin auth=' +
                GLOBAL_config.GOOGLE_RESEARCH_API_KEY
          },
          method: 'POST',
          url: 'https://www.googleapis.com/language/translate/v2',
          body: 'key=' + GLOBAL_config.GOOGLE_RESEARCH_API_KEY + '&target=en'
        };

      } else {
        options = {
          headers: {
            'X-HTTP-Method-Override': 'GET',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
          },
          method: 'POST',
          url: 'https://www.googleapis.com/language/translate/v2',
          body: 'key=' + GLOBAL_config.GOOGLE_KEY + '&target=en'
        };
      }
      var collector = {};
      Step(
        function() {
          var group = this.group();
          var services = typeof json === 'object' ? Object.keys(json) : [];
          services.forEach(function(serviceName) {
            var cb = group();
            var service = json[serviceName] || [];
            collector[serviceName] = [];
            service.forEach(function(item, i) {
              var text = item.micropost.clean;
              if (GLOBAL_config.USE_GOOGLE_RESEARCH_API) {
                //options.body = 'tl=en&q=' + encodeURIComponent(text);
                options.body += '&q=' + encodeURIComponent(text);
              } else {
                options.body += '&q=' + encodeURIComponent(text);
              }
              collector[serviceName][i] = {
                text: '',
                language: ''
              };
            });
            request(options, function(err1, res1, body) {
//  FixMe console.log(JSON.stringify(options))
              var response;
              /* jshint noempty:false */
              if (GLOBAL_config.USE_GOOGLE_RESEARCH_API) {
// FixMe console.log('hello')
// FixMe res.send(body);
              } else {   /* jshint noempty:true */
                if (!err1 && res1.statusCode === 200) {
                  try {
                    response = JSON.parse(body);
                  } catch(e) {
                    // error
                    return cb(null);
                  }
                  if ((response.data) &&
                      (response.data.translations) &&
                      (Array.isArray(response.data.translations))) {
                    response.data.translations.forEach(
                        function(translation, j) {
                      collector[serviceName][j] = {
                        text: replaceHtmlEntities(translation.translatedText),
                        language: translation.detectedSourceLanguage
                      };
                    });
                  }
                } else {
                  // error
                  return cb(null);
                }
              }
              cb(null);
            });
          });
        },
        function() {
          var services = typeof json === 'object' ? Object.keys(json) : [];
          services.forEach(function(serviceName) {
            var service = json[serviceName] || [];
            service.forEach(function(item, i) {
              item.micropost.translation = collector[serviceName][i];
            });
          });
          spotlight(json);
        }
      );
    }

    /**
     * Collects results to be sent back to the client
     */
    function collectResults(json, service, pendingRequests) {
      if (GLOBAL_config.DEBUG) { console.log('collectResults for ' + service); }
      /* global io:false */
      if (io) {
        io.sockets.emit('mediaResults', {
          service: service
        });
      }
      if (!pendingRequests) {
        if (service !== 'combined') {
          var temp = json;
          json = {};
          json[service] = temp;
        }
        // make sure that after a timeout, where a service's result can still be
        // the initial value of boolean false, we set the value to empty array
        var services = typeof json === 'object' ? Object.keys(json) : [];
        services.forEach(function(serviceName) {
          if (json[serviceName] === false) {
            json[serviceName] = [];
          }
        });
        if (GLOBAL_config.TRANSLATE) {
          translate(json);
        } else {
          spotlight(json);
        }
      } else {
        pendingRequests[service] = json;
      }
    }

    /**
     * Sends results back to the client
     */
    function sendResults(json) {
      if (GLOBAL_config.DEBUG) { console.log('sendResults'); }
      callback(json);
    }

    var services = {
      GooglePlus: function(pendingRequests) {
        var currentService = 'GooglePlus';
        if (GLOBAL_config.DEBUG) {
          console.log(currentService + ' *** ' + query);
        }
        var options = {
          url: 'https://www.googleapis.com/plus/v1/activities?query=' +
              encodeURIComponent(query) +
              '&orderBy=recent&key=' + GLOBAL_config.GOOGLE_KEY,
          headers: GLOBAL_config.HEADERS
        };
        if (GLOBAL_config.DEBUG) {
          console.log(currentService + ' ' + options.url);
        }
        request.get(options, function(err, reply, body) {
          var results = [];
          try {
            body = JSON.parse(body);
            if (body.items && Array.isArray(body.items)) {
              var itemsLength = body.items.length;
              body.items.forEach(function(item, processedItems) {
                // only treat posts, notes, and shares, no check-ins
                if (((item.verb === 'share') ||
                     (item.verb === 'post') ||
                     (item.verb === 'note')) &&
                    (item.object.attachments) &&
                    (Array.isArray(item.object.attachments))) {
                  item.object.attachments.forEach(function(attachment) {
                    // only treat photos, videos, and articles
                    if ((attachment.objectType !== 'photo') &&
                        (attachment.objectType !== 'video') &&
                        (attachment.objectType !== 'article')) {
                      processedItems++;
                      if (processedItems === itemsLength) {
                        collectResults(results, currentService,
                            pendingRequests);
                      }
                      return;
                    }
                    // the micropost can consist of different parts, dependent
                    // on the item type
                    var micropost = cleanMicropost(
                        (item.object.content ?
                            item.object.content : '') +
                        (item.title ?
                            ' ' + item.title : '') +
                        (item.annotation ?
                            ' ' + item.annotation : '') +
                        (attachment.displayName ?
                            ' ' + attachment.displayName : ''));
                    if (micropost) {
                      var mediaUrl = '';
                      if (attachment.embed) {
                        mediaUrl = attachment.embed.url;
                      } else if (attachment.fullImage) {
                        mediaUrl = attachment.fullImage.url;
                      }
                      cleanVideoUrl(mediaUrl, function(cleanedMediaUrl) {
                        processedItems++;
                        if (cleanedMediaUrl) {
                          results.push({
                            mediaUrl: cleanedMediaUrl,
                            posterUrl: attachment.image.url,
                            micropostUrl: item.url,
                            micropost: micropost,
                            userProfileUrl: item.actor.url,
                            type: attachment.objectType === 'video' ?
                                'video' : 'photo',
                            timestamp: (new Date(item.published)).getTime(),
                            publicationDate: item.published,
                            socialInteractions: {
                              likes: item.object.plusoners.totalItems,
                              shares: item.object.resharers.totalItems,
                              comments: item.object.replies.totalItems,
                              views: null
                            }
                          });
                        }
                        if (processedItems === itemsLength) {
                          collectResults(results, currentService,
                              pendingRequests);
                        }
                      });
                    } else {
                      processedItems++;
                      if (processedItems === itemsLength) {
                        collectResults(results, currentService,
                            pendingRequests);
                      }
                    }
                  });
                } else {
                  processedItems++;
                  if (processedItems === itemsLength) {
                    collectResults(results, currentService, pendingRequests);
                  }
                }
              });
            } else {
              collectResults(results, currentService, pendingRequests);
            }
          } catch(e) {
            collectResults(results, currentService, pendingRequests);
          }
        });
      },
      Facebook: function(pendingRequests) {
        var currentService = 'Facebook';
        if (GLOBAL_config.DEBUG) {
          console.log(currentService + ' *** ' + query);
        }
        var params = {
          q: query,
          limit: 100,
          fields: 'comments,type,created_time,name,caption,description,' +
              'source,picture,id,from,likes,shares',
          access_token: GLOBAL_config.FACEBOOK_APP_ID + '|' +
              GLOBAL_config.FACEBOOK_APP_SECRET
        };
        params = querystring.stringify(params);
        var options = {
          url: 'https://graph.facebook.com/search?' + params + '&type=post',
          headers: GLOBAL_config.HEADERS
        };
        if (GLOBAL_config.DEBUG) {
          console.log(currentService + ' ' + options.url);
        }
        request.get(options, function(err, reply, body) {
          try {
            body = JSON.parse(body);
            var results = [];
            if ((body.data) && (body.data.length)) {
              var items = body.data;
              Step(
                function() {
                  var group = this.group();
                  items.forEach(function(item) {
                    var cb = group();
                    if (item.type !== 'photo' && item.type !== 'video') {
                      cb(null);
                    }
                    var timestamp = Date.parse(item.created_time);
                    var micropost = '';
                    micropost += (item.name ? item.name : '');
                    micropost += (item.caption ?
                        (micropost.length ? '. ' : '') + item.caption : '');
                    micropost += (item.description ?
                        (micropost.length ? '. ' : '') + item.description : '');
                    micropost += (item.micropost ?
                        (micropost.length ? '. ' : '') + item.micropost : '');
                    // Facebook does not support phrase search, so we manually
                    // need to test if the serch term is contained.
                    // (http://support.gnip.com/sources/facebook.html#Streams)
                    if (micropost.indexOf(query.replace(/"/g, '')) === -1) {
                      cb(null);
                    }
                    var mediaUrl = item.type === 'video' ?
                        item.source : item.picture;
                    if (item.type === 'video') {
                      cleanVideoUrl(mediaUrl, function(cleanedMediaUrl) {
                        if ((cleanedMediaUrl) &&
                            (item.picture) &&
                            (cleanedMediaUrl !== mediaUrl)) {
                          results.push({
                            mediaUrl: cleanedMediaUrl
                                .replace(/s\.jpg$/gi, 'n.jpg'),
                            posterUrl: item.picture,
                            micropostUrl: 'https://www.facebook.com/' +
                                'permalink.php?story_fbid=' +
                                item.id.split(/_/)[1] + '&id=' + item.from.id,
                            micropost: cleanMicropost(micropost),
                            userProfileUrl:
                                'https://www.facebook.com/profile.php?id=' +
                                item.from.id,
                            type: item.type,
                            timestamp: timestamp,
                            publicationDate: getIsoDateString(timestamp),
                            socialInteractions: {
                              likes: item.likes ? item.likes.count : null,
                              shares: item.shares ? item.shares.count : null,
                              comments: item.comments ?
                                  item.comments.data.length : null,
                              views: null
                            }
                          });
                        }
                        cb(null);
                      });
                    } else {
                      results.push({
                        mediaUrl: mediaUrl.replace(/s\.jpg$/gi, 'n.jpg'),
                        posterUrl: item.picture,
                        micropostUrl:
                            'https://www.facebook.com/permalink.php?' +
                            'story_fbid=' + item.id.split(/_/)[1] + '&id=' +
                            item.from.id,
                        micropost: cleanMicropost(micropost),
                        userProfileUrl:
                            'https://www.facebook.com/profile.php?id=' +
                            item.from.id,
                        type: item.type,
                        timestamp: timestamp,
                        publicationDate: getIsoDateString(timestamp),
                        socialInteractions: {
                          likes: item.likes ? item.likes.count : null,
                          shares: item.shares ? item.shares.count : null,
                          comments: item.comments ? item.comments.count : null,
                          views: null
                        }
                      });
                      cb(null);
                    }
                  });
                },
                function() {
                  collectResults(results, currentService, pendingRequests);
                }
              );
            } else {
              collectResults(results, currentService, pendingRequests);
            }
          } catch(e) {
            collectResults(results, currentService, pendingRequests);
          }
        });
      },
      TwitterNative: function(pendingRequests) {
        var currentService = 'TwitterNative';
        if (GLOBAL_config.DEBUG) {
          console.log(currentService + ' *** ' + query);
        }
        twit.search(
            {
              q: query + ' ' + GLOBAL_config.MEDIA_PLATFORMS.join(' OR ') +
                  ' -"RT "',
              rpp: 20,
              result_type: 'recent',
              include_entities: true,
            },
            function(err, body) {
          try {
            var results = [];
            if ((body.statuses) && (body.statuses.length)) {
              var items = body.statuses;
              for (var i = 0, len = items.length; i < len; i++) {
                var item = items[i];
                var mediaUrl = '';
                if (item.entities && item.entities.media &&
                    item.entities.media.length > 0) {
                  mediaUrl = item.entities.media[0].media_url ?
                      item.entities.media[0].media_url :
                      item.entities.media[0].media_url_https;
                  var timestamp = Date.parse(item.created_at);
                  var publicationDate = getIsoDateString(timestamp);
                  var micropost = cleanMicropost(item.text);
                  var userProfileUrl = 'http://twitter.com/' +
                      item.user.screen_name;
                  var micropostUrl = 'http://twitter.com/' +
                      item.user.screen_name + '/status/' + item.id_str;
                  results.push({
                    mediaUrl: mediaUrl,
                    posterUrl: mediaUrl + ':thumb',
                    micropostUrl: micropostUrl,
                    micropost: micropost,
                    userProfileUrl: userProfileUrl,
                    type: 'photo',
                    timestamp: timestamp,
                    publicationDate: publicationDate,
                    socialInteractions: {
                      likes: item.favorite_count,
                      shares: item.retweet_count,
                      comments: null,
                      views: null
                    }
                  });
                }
              }
            }
            collectResults(results, currentService, pendingRequests);
          } catch(e) {
            collectResults([], currentService, pendingRequests);
          }
        });
      },
      Twitter: function(pendingRequests) {
        var currentService = 'Twitter';
        if (GLOBAL_config.DEBUG) {
          console.log(currentService + ' *** ' + query);
        }
        twit.search(
            {
              q: query + ' AND %28' +
                  GLOBAL_config.MEDIA_PLATFORMS.join(' OR ') + '%29 -"RT "',
              rpp: 20,
              result_type: 'recent',
              include_entities: true,
            },
            function(err, body) {
          try {
            var results = [];
            if ((body.statuses) && (body.statuses.length)) {
              var items = body.statuses;
              var itemStack = [];
              var numberOfUrls = 0;
              var pendingUrls = 0;
              for (var i = 0, len = items.length; i < len; i++) {
                var item = items[i];
                // extract all URLs form a tweet
                if (!item.entities.urls.length) {
                  continue;
                }
                var len2 = item.entities.urls.length;
                for (var j = 0; j < len2; j++) {
                  var url = item.entities.urls[j].expanded_url;
                  var host = URL.parse(url).host;
                  if (GLOBAL_config.MEDIA_PLATFORMS.indexOf(host) !== -1) {
                    numberOfUrls++;
                    var timestamp = Date.parse(item.created_at);
                    var publicationDate = getIsoDateString(timestamp);
                    var micropost = cleanMicropost(item.text);
                    var userProfileUrl = 'http://twitter.com/' +
                        item.user.screen_name;
                    var mediaUrl = url;
                    var micropostUrl = 'http://twitter.com/' +
                        item.user.screen_name + '/status/' + item.id_str;
                    // vine.co
                    if (mediaUrl.indexOf('https://vine.co') === 0) {
                      var options = {
                        url: mediaUrl
                      };
                      (function(micropost, userProfileUrl, timestamp,
                          publicationDate) {
                        request.get(options, function(err, result, body) {
                          scrapeVine(body, function(videoUrl, posterUrl) {
                            if (videoUrl && posterUrl) {
                              results.push({
                                mediaUrl: videoUrl,
                                posterUrl: posterUrl,
                                micropostUrl: micropostUrl,
                                micropost: micropost,
                                userProfileUrl: userProfileUrl,
                                type: 'video',
                                timestamp: timestamp,
                                publicationDate: publicationDate,
                                socialInteractions: {
                                  likes: item.favorite_count,
                                  shares: item.retweet_count,
                                  comments: null,
                                  views: null
                                }
                              });
                            }
                            pendingUrls++;
                            if (pendingUrls === numberOfUrls) {
                              collectResults(
                                  results, currentService, pendingRequests);
                            }
                          });
                        });
                      })(micropost, userProfileUrl, timestamp, publicationDate);
                    // yfrog
                    } else if (mediaUrl.indexOf('http://yfrog.com') === 0) {
                      results.push({
                        mediaUrl: mediaUrl + ':iphone',
                        posterUrl: mediaUrl + ':small',
                        micropostUrl: micropostUrl,
                        micropost: micropost,
                        userProfileUrl: userProfileUrl,
                        type: 'photo',
                        timestamp: timestamp,
                        publicationDate: publicationDate,
                        socialInteractions: {
                          likes: item.favorite_count,
                          shares: item.retweet_count,
                          comments: null,
                          views: null
                        }
                      });
                      pendingUrls++;
                      if (pendingUrls === numberOfUrls) {
                        collectResults(
                            results, currentService, pendingRequests);
                      }
                    // TwitPic
                    } else if (mediaUrl.indexOf('http://twitpic.com') === 0) {
                      var id = mediaUrl.replace('http://twitpic.com/', '')
                          .replace('show/', '')
                          .replace('large/', '')
                          .replace('thumbnail/', '')
                          .replace('/full', '');
                      var options = {
                        url: 'http://twitpic.com/' + id + '/full'
                      };
                      (function(micropost, userProfileUrl, timestamp,
                          publicationDate) {
                        request.get(options, function(err, res, body) {
                          scrapeTwitPic(body, function(mediaUrl, type) {
                            if (mediaUrl) {
                              results.push({
                                mediaUrl: mediaUrl,
                                posterUrl: 'http://twitpic.com/show/thumb/' +
                                    id,
                                micropostUrl: micropostUrl,
                                micropost: micropost,
                                userProfileUrl: userProfileUrl,
                                type: type,
                                timestamp: timestamp,
                                publicationDate: publicationDate,
                                socialInteractions: {
                                  likes: item.favorite_count,
                                  shares: item.retweet_count,
                                  comments: null,
                                  views: null
                                }
                              });
                            }
                            pendingUrls++;
                            if (pendingUrls === numberOfUrls) {
                              collectResults(
                                  results, currentService, pendingRequests);
                            }
                          });
                        });
                      })(micropost, userProfileUrl, timestamp, publicationDate);
                    // img.ly
                    } else if (mediaUrl.indexOf('http://img.ly') === 0) {
                      var id = mediaUrl.replace('http://img.ly/', '');
                      var options = {
                        url: 'http://img.ly/' + id
                      };
                      (function(micropost, userProfileUrl, timestamp,
                          publicationDate) {
                        request.get(options, function(err, res, body) {
                          scrapeImgLy(body, function(mediaUrl) {
                            if (mediaUrl) {
                              results.push({
                                mediaUrl: mediaUrl,
                                posterUrl: mediaUrl,
                                micropostUrl: micropostUrl,
                                micropost: micropost,
                                userProfileUrl: userProfileUrl,
                                type: 'photo',
                                timestamp: timestamp,
                                publicationDate: publicationDate,
                                socialInteractions: {
                                  likes: item.favorite_count,
                                  shares: item.retweet_count,
                                  comments: null,
                                  views: null
                                }
                              });
                            }
                            pendingUrls++;
                            if (pendingUrls === numberOfUrls) {
                              collectResults(
                                  results, currentService, pendingRequests);
                            }
                          });
                        });
                      })(micropost, userProfileUrl, timestamp, publicationDate);
                    // Instagram
                    } else if (
                        (mediaUrl.indexOf('http://instagr.am') === 0) ||
                        (mediaUrl.indexOf('http://instagram.com') === 0)) {
                      var id = mediaUrl
                          .replace('http://instagram.com', 'http://instagr.am')
                          .replace('http://instagr.am/p/', '');
                      var options = {
                        url: 'https://api.instagram.com/v1/media/' + id +
                            '?access_token=' + GLOBAL_config.INSTAGRAM_SECRET
                      };
                      (function(micropost, userProfileUrl, timestamp,
                          publicationDate) {
                        request.get(options, function(err, result, body) {
                          try {
                            body = JSON.parse(body);
                            if ((body.data) && (body.data.images) &&
                                (body.data.images.standard_resolution ) &&
                                (body.data.images.standard_resolution.url)) {
                              results.push({
                                mediaUrl:
                                    body.data.images.standard_resolution.url,
                                posterUrl: body.data.images.thumbnail.url,
                                micropostUrl: micropostUrl,
                                micropost: micropost,
                                userProfileUrl: userProfileUrl,
                                type: 'photo',
                                timestamp: timestamp,
                                publicationDate: publicationDate,
                                socialInteractions: {
                                  likes: item.favorite_count,
                                  shares: item.retweet_count,
                                  comments: null,
                                  views: null
                                }
                              });
                            }
                          } catch(e) {
                            // noop
                          }
                          pendingUrls++;
                          if (pendingUrls === numberOfUrls) {
                            collectResults(
                                results, currentService, pendingRequests);
                          }
                        });
                      })(micropost, userProfileUrl, timestamp, publicationDate);
                    } else if (
                        (mediaUrl.indexOf('http://youtu.be') === 0) ||
                        (mediaUrl.indexOf('http://www.youtube.com') === 0) ||
                        (mediaUrl.indexOf('https://www.youtube.com') === 0)) {
                      (function(mediaUrl) {
                        cleanVideoUrl(mediaUrl, function(cleanedVideoUrl,
                            videoId) {
                          if (cleanedVideoUrl && cleanedVideoUrl !== mediaUrl) {
                            results.push({
                              mediaUrl: cleanedVideoUrl,
                              posterUrl: 'http://img.youtube.com/vi/' +
                                  videoId + '/maxresdefault.jpg',
                              micropostUrl: micropostUrl,
                              micropost: micropost,
                              userProfileUrl: userProfileUrl,
                              type: 'video',
                              timestamp: timestamp,
                              publicationDate: publicationDate,
                              socialInteractions: {
                                likes: item.favorite_count,
                                shares: item.retweet_count,
                                comments: null,
                                views: null
                              }
                            });
                          }
                          pendingUrls++;
                          if (pendingUrls === numberOfUrls) {
                            collectResults(
                                results, currentService, pendingRequests);
                          }
                        });
                      })(mediaUrl);
                    // URL from unsupported media platform, don't consider it
                    } else {
                      numberOfUrls--;
                    }
                  }
                }
              }
              if (pendingUrls === numberOfUrls) {
                collectResults(
                    results, currentService, pendingRequests);
              }
            } else {
              collectResults([], currentService, pendingRequests);
            }
          } catch(e) {
            collectResults([], currentService, pendingRequests);
          }
        });
      },
      Instagram: function(pendingRequests) {
        var currentService = 'Instagram';
        if (GLOBAL_config.DEBUG) {
          console.log(currentService + ' *** ' + query);
        }
        var params = {
          client_id: GLOBAL_config.INSTAGRAM_KEY
        };
        params = querystring.stringify(params);
        var options = {
          url: 'https://api.instagram.com/v1/tags/' +
              query.replace(/\s*/g, '')
              .replace(GLOBAL_config.INSTAGRAM_REGEX, '').toLowerCase() +
              '/media/recent?' + params,
          headers: GLOBAL_config.HEADERS
        };
        var results = [];
        if (GLOBAL_config.DEBUG) {
          console.log(currentService + ' ' + options.url);
        }
        request.get(options, function(err, reply, body) {
          try {
            body = JSON.parse(body);
            if ((body.data) && (body.data.length)) {
              var items = body.data;
              for (var i = 0, len = items.length; i < len; i++) {
                var item = items[i];
                var timestamp = parseInt(item.created_time + '000', 10);
                var micropost = '';
                micropost += (item.caption && item.caption.text ?
                    item.caption.text : '');
                micropost += (micropost.length ? '. ' : '') +
                    (item.tags && Array.isArray(item.tags) ?
                        item.tags.join(', ') : '');
                results.push({
                  mediaUrl: item.images.standard_resolution.url,
                  posterUrl: item.images.thumbnail.url,
                  micropostUrl: item.link,
                  micropost: cleanMicropost(micropost),
                  userProfileUrl: 'https://api.instagram.com/v1/users/' +
                      item.user.id,
                  type: item.type === 'image'? 'photo' : '',
                  timestamp: timestamp,
                  publicationDate: getIsoDateString(timestamp),
                  socialInteractions: {
                    likes: item.likes.count,
                    shares: null,
                    comments: item.comments.count,
                    views: null
                  }
                });
              }
            }
          } catch(e) {
            // noop
          }
          collectResults(results, currentService, pendingRequests);
        });
      },
      YouTube: function(pendingRequests) {
        var currentService = 'YouTube';
        if (GLOBAL_config.DEBUG) {
          console.log(currentService + ' *** ' + query);
        }
        var params = {
          v: 2,
          format: 5,
          safeSearch: 'none',
          q: query,
          alt: 'jsonc',
          'max-results': 10,
          'start-index': 1,
          time: 'this_week'
        };
        params = querystring.stringify(params);
        var options = {
          url: 'http://gdata.youtube.com/feeds/api/videos?' + params,
          headers: GLOBAL_config.HEADERS
        };
        if (GLOBAL_config.DEBUG) {
          console.log(currentService + ' ' + options.url);
        }
        request.get(options, function(err, reply, body) {
          try {
            body = JSON.parse(body);
            var results = [];
            if ((body.data) && (body.data.items)) {
              var items = body.data.items;
              Step(
                function() {
                  var group = this.group();
                  items.forEach(function(item) {
                    if (item.accessControl.embed !== 'allowed') {
                      return;
                    }
                    var cb = group();
                    var timestamp = Date.parse(item.uploaded);
                    var url = item.player.default;
                    cleanVideoUrl(url, function(cleanedVideoUrl) {
                      if (cleanedVideoUrl !== url) {
                        results.push({
                          mediaUrl: cleanedVideoUrl,
                          posterUrl: item.thumbnail.hqDefault,
                          micropostUrl: url,
                          micropost: cleanMicropost(
                              item.title + '. ' + item.description),
                          userProfileUrl: 'http://www.youtube.com/' +
                              item.uploader,
                          type: 'video',
                          timestamp: timestamp,
                          publicationDate: getIsoDateString(timestamp),
                          socialInteractions: {
                            likes: (parseInt((item.likeCount ?
                                item.likeCount : 0), 10) +
                                parseInt((item.favoriteCount ?
                                item.favoriteCount : 0), 10)),
                            shares: null,
                            comments: parseInt((item.commentCount ?
                                item.commentCount : 0), 10),
                            views: parseInt((item.viewCount ?
                                item.viewCount : 0), 10)
                          }
                        });
                      }
                      cb(null);
                    });
                  });
                },
                function() {
                  collectResults(results, currentService, pendingRequests);
                }
              );
            } else {
              collectResults(results, currentService, pendingRequests);
            }
          } catch(e) {
            collectResults(results, currentService, pendingRequests);
          }
        });
      },
      FlickrVideos: function(pendingRequests) {
        services.Flickr(pendingRequests, true);
      },
      Flickr: function(pendingRequests, videoSearch) {
        var currentService = videoSearch ? 'FlickrVideos' : 'Flickr';
        if (GLOBAL_config.DEBUG) {
          console.log(currentService + ' *** ' + query);
        }
        var now = ~~(new Date().getTime() / 1000);
        var sixDays = 86400 * 6;
        var params = {
          method: 'flickr.photos.search',
          api_key: GLOBAL_config.FLICKR_KEY,
          text: query,
          format: 'json',
          nojsoncallback: 1,
          min_taken_date: now - sixDays,
          media: (videoSearch ? 'videos' : 'photos'),
          per_page: 20
        };
        params = querystring.stringify(params);
        var options = {
          url: 'https://api.flickr.com/services/rest/?' + params,
          headers: GLOBAL_config.HEADERS
        };
        if (GLOBAL_config.DEBUG) {
          console.log(currentService + ' ' + options.url);
        }
        request.get(options, function(err, reply, body) {
          try {
            body = JSON.parse(body);
            var results = [];
            if ((body.photos) && (body.photos.photo)) {
              var photos = body.photos.photo;
              Step(
                function() {
                  var group = this.group();
                  for (var i = 0, len = photos.length; i < len; i++) {
                    var photo = photos[i];
                    if (photo.ispublic) {
                      var params = {
                        method: 'flickr.photos.getInfo',
                        api_key: GLOBAL_config.FLICKR_KEY,
                        format: 'json',
                        nojsoncallback: 1,
                        photo_id: photo.id
                      };
                      params = querystring.stringify(params);
                      var options = {
                        url: 'https://api.flickr.com/services/rest/?' + params,
                        headers: GLOBAL_config.HEADERS
                      };
                      var cb = group();
                      request.get(options, function(err2, reply2, body2) {
                        try {
                          body2 = JSON.parse(body2);
                          var tags = [];
                          if ((body2.photo) &&
                              (body2.photo.tags) &&
                              (body2.photo.tags.tag) &&
                              (Array.isArray(body2.photo.tags.tag))) {
                            body2.photo.tags.tag.forEach(function(tag) {
                              tags.push(tag._content);
                            });
                          }
                          var photo2 = body2.photo;
                          var timestamp = Date.parse(photo2.dates.taken);
                          var params = {
                            method: 'flickr.photos.getSizes',
                            api_key: GLOBAL_config.FLICKR_KEY,
                            format: 'json',
                            nojsoncallback: 1,
                            photo_id: photo2.id
                          };
                          params = querystring.stringify(params);
                          var options = {
                            url: 'https://api.flickr.com/services/rest/?' +
                                params,
                            headers: GLOBAL_config.HEADERS
                          };
                          request.get(options, function(err, res2, body) {
                            try {
                              body = JSON.parse(body);
                              if ((body.sizes) && (body.sizes.size) &&
                                  (Array.isArray(body.sizes.size))) {
                                var mediaUrl = false;
                                var posterUrl = false;
                                body.sizes.size.forEach(function(size) {
                                  // take the picture in the best-possible
                                  // resolution, the highest resolution
                                  // (unknown) is always the last in the sizes
                                  // array
                                  if ((!videoSearch) &&
                                      ((size.label === 'Original') ||
                                       (size.label === 'Large') ||
                                       (size.label === 'Medium 640') ||
                                       (size.label === 'Medium 640') ||
                                       (size.label === 'Medium') ||
                                       (size.label === 'Small') ||
                                       (size.label === 'Thumbnail') ||
                                       (size.label === 'Square'))) {
                                    mediaUrl = size.source;
                                  }
                                  if (size.label === 'Thumbnail') {
                                    posterUrl = size.source;
                                  }
                                  // take the video in the best-possible quality
                                  if ((videoSearch) &&
                                      ((size.label === 'Site MP4') ||
                                       (size.label === 'Mobile MP4'))) {
                                    mediaUrl = size.source;
                                  }
                                });
                                var params = {
                                  method: 'flickr.photos.getFavorites',
                                  api_key: GLOBAL_config.FLICKR_KEY,
                                  format: 'json',
                                  nojsoncallback: 1,
                                  photo_id: photo2.id
                                };
                                params = querystring.stringify(params);
                                var options = {
                                  url: 'https://api.flickr.com/services/' +
                                      'rest/?' + params,
                                  headers: GLOBAL_config.HEADERS
                                };
                                request.get(options, function(err, res2, body) {
                                  try {
                                    body = JSON.parse(body);
                                    results.push({
                                      mediaUrl: mediaUrl,
                                      posterUrl: posterUrl,
                                      micropostUrl:
                                          'https://www.flickr.com/photos/' +
                                          photo2.owner.nsid + '/' + photo2.id +
                                          '/',
                                      micropost: cleanMicropost(
                                          photo2.title._content +
                                          '. ' + photo2.description._content +
                                          tags.join(', ')),
                                      userProfileUrl:
                                          'https://www.flickr.com/photos/' +
                                          photo2.owner.nsid + '/',
                                      type: (videoSearch ? 'video' : 'photo'),
                                      timestamp: timestamp,
                                      publicationDate:
                                          getIsoDateString(timestamp),
                                      socialInteractions: {
                                        likes: parseInt(body.photo.total, 10),
                                        shares: null,
                                        comments: parseInt(
                                            photo2.comments._content, 10),
                                        views: parseInt(photo2.views, 10)
                                      }
                                    });
                                    cb();
                                  } catch(e) {
                                    cb();
                                  }
                                });
                              }
                            } catch(e) {
                              cb();
                            }
                          });
                        } catch(e) {
                          cb();
                        }
                      });
                    }
                  }
                },
                function() {
                  collectResults(results, currentService, pendingRequests);
                }
              );
            } else {
              collectResults([], currentService, pendingRequests);
            }
          } catch(e) {
            collectResults([], currentService, pendingRequests);
          }
        });
      },
      MobyPicture: function(pendingRequests) {
        var currentService = 'MobyPicture';
        if (GLOBAL_config.DEBUG) {
          console.log(currentService + ' *** ' + query);
        }
        var params = {
          key: GLOBAL_config.MOBYPICTURE_KEY,
          action: 'searchPosts',
          format: 'json',
          searchTerms: query
        };
        params = querystring.stringify(params);
        var options = {
          url: 'http://api.mobypicture.com/?' + params,
          headers: GLOBAL_config.HEADERS
        };
        if (GLOBAL_config.DEBUG) {
          console.log(currentService + ' ' + options.url);
        }
        request.get(options, function(err, reply, body1) {
          var results = [];
          try {
            body1 = JSON.parse(body1);
            if ((body1.results) && (body1.results.length)) {
              var items = body1.results;
              Step(
                function() {
                  var group = this.group();
                  for (var i = 0, len = items.length; i < len; i++) {
                    var cb = group();
                    var item = items[i];
                    params = {
                      key: GLOBAL_config.MOBYPICTURE_KEY,
                      action: 'getMediaInfo',
                      format: 'json',
                      tinyurl_code: item.post.link_tiny
                    };
                    params = querystring.stringify(params);
                    options = {
                      url: 'http://api.mobypicture.com/?' + params,
                      headers: GLOBAL_config.HEADERS
                    };
                    request.get(options, function(err, reply, body2) {
                      try {
                        body2 = JSON.parse(body2);
                        var mediaUrl = body2.post.media.url_full;
                        var posterUrl = body2.post.media.url_thumbnail;
                        var micropostUrl = body2.post.link;
                        var timestamp = body2.post.created_on_epoch * 1000;
                        var micropost = body2.post.title + '. ' +
                            item.post.description;
                        var userProfileUrl = body2.user.url;
                        var type = body2.post.media.type;
                        var views = parseInt(body2.post.views, 10);
                        var comments = parseInt(body2.post.comments, 10);
                        params = {
                          key: GLOBAL_config.MOBYPICTURE_KEY,
                          action: 'getLikes',
                          format: 'json',
                          tinyurl_code: body2.post.link_tiny
                        };
                        params = querystring.stringify(params);
                        options = {
                          url: 'http://api.mobypicture.com/?' + params,
                          headers: GLOBAL_config.HEADERS
                        };
                        request.get(options, function(err, reply, body3) {
                          try {
                            body3 = JSON.parse(body3);
                            results.push({
                              mediaUrl: mediaUrl,
                              posterUrl: posterUrl,
                              micropostUrl: micropostUrl,
                              micropost: cleanMicropost(
                                  micropost),
                              userProfileUrl: userProfileUrl,
                              type: type,
                              timestamp: timestamp,
                              publicationDate: getIsoDateString(timestamp),
                              socialInteractions: {
                                likes: parseInt(body3.votes, 10),
                                shares: null,
                                comments: comments,
                                views: views
                              }
                            });
                            cb();
                          } catch(e) {
                            cb();
                          }
                        });
                      } catch(e) {
                        cb();
                      }
                    });
                  }
                },
                function() {
                  collectResults(results, currentService, pendingRequests);
                }
              );
            } else {
              collectResults(results, currentService, pendingRequests);
            }
          } catch(e) {
            collectResults(results, currentService, pendingRequests);
          }
        });
      },
      TwitPic: function(pendingRequests) {
        var currentService = 'TwitPic';
        if (GLOBAL_config.DEBUG) {
          console.log(currentService + ' *** ' + query);
        }
        var params = {
          tag: query
        };
        params = querystring.stringify(params);
        var headers = GLOBAL_config.HEADERS;
        var options = {
          url: 'http://api.twitpic.com/2/tags/show.json?' + params,
          headers: headers
        };
        if (GLOBAL_config.DEBUG) {
          console.log(currentService + ' ' + options.url);
        }
        request.get(options, function(err, reply, body) {
          var results = [];
          try {
            body = JSON.parse(body);
            if (body.images && body.images.length > 0) {
              Step(
                function() {
                  var group = this.group();
                  for (var i = 0, len = body.images.length; i < len; i++) {
                    (function(image) {
                      var userProfileUrl = 'http://twitpic.com/photos/' +
                          image.user.username;
                      var micropost = image.message;
                      var timestamp = (new Date(image.timestamp)).getTime();
                      var publicationDate = getIsoDateString(timestamp);
                      var micropostUrl = 'http://twitpic.com/' + image.short_id;
                      var views = parseInt(image.views, 10);
                      var comments = parseInt(image.number_of_comments, 10);
                      var cb = group();
                      request.get(micropostUrl + '/full', function(err2,
                          reply2, body2) {
                        scrapeTwitPic(body2, function(mediaUrl, type) {
                          results.push({
                            mediaUrl: mediaUrl,
                            posterUrl: 'http://twitpic.com/show/thumb/' +
                                image.short_id,
                            micropostUrl: micropostUrl,
                            micropost: cleanMicropost(micropost),
                            userProfileUrl: userProfileUrl,
                            type: type,
                            timestamp: timestamp,
                            publicationDate: publicationDate,
                            socialInteractions: {
                              likes: null,
                              shares: null,
                              comments: comments,
                              views: views
                            }
                          });
                          cb();
                        });
                      });
                    })(body.images[i]);
                  }
                },
                function() {
                  collectResults(results, currentService, pendingRequests);
                }
              );
            } else {
              collectResults(results, currentService, pendingRequests);
            }
          } catch(e) {
            collectResults(results, currentService, pendingRequests);
          }
        });
      },
      WikimediaCommons: function(pendingRequests) {
        var currentService = 'WikimediaCommons';
        if (GLOBAL_config.DEBUG) {
          console.log(currentService + ' *** ' + query);
        }
        var params = {
          action: 'query',
          generator: 'search',
          gsrnamespace: 6,
          gsrsearch: query,
          gsrlimit: 500,
          prop: 'imageinfo|globalusage',
          iiprop: 'url|timestamp|user',
          format: 'json'
        };
        params = querystring.stringify(params);
        var headers = GLOBAL_config.HEADERS;
        var options = {
          url: 'https://commons.wikimedia.org/w/api.php?' + params,
          headers: headers
        };
        if (GLOBAL_config.DEBUG) {
          console.log(currentService + ' ' + options.url);
        }
        request.get(options, function(err, reply, body) {
          var results = [];
          try {
            body = JSON.parse(body);
            if (body && body.query && body.query.pages) {
              for (var pageId in body.query.pages) {
                var page = body.query.pages[pageId];
                var title = page.title.replace('File:', '');
                var posterUrl = page.imageinfo[0].url.replace(
                    'https://upload.wikimedia.org/wikipedia/commons/',
                    'https://upload.wikimedia.org/wikipedia/commons/thumb/') +
                    '/500px-' + encodeURIComponent(title.replace(/\s/g, '_'));
                results.push({
                  mediaUrl: page.imageinfo[0].url,
                  posterUrl: posterUrl,
                  micropostUrl: page.imageinfo[0].descriptionurl,
                  micropost: cleanMicropost(title.replace(
                        /(\.jpg|\.png|\.gif|\.webp)$/gi, '')),
                  userProfileUrl: 'https://commons.wikimedia.org/wiki/User:' +
                      page.imageinfo[0].user,
                  type: 'photo',
                  timestamp: (new Date(page.imageinfo[0].timestamp)).getTime(),
                  publicationDate: page.imageinfo[0].timestamp,
                  socialInteractions: {
                    likes: null,
                    shares: page.globalusage.length,
                    comments: null,
                    views: null
                  }
                });
              }
              results.sort(function (a, b) {
                return (a.socialInteractions.shares -
                    b.socialInteractions.shares);
              });
              collectResults(results, currentService, pendingRequests);
            } else {
              collectResults(results, currentService, pendingRequests);
            }
          } catch(e) {
            collectResults(results, currentService, pendingRequests);
          }
        });
      }
    };
    if (services[service]) {
      services[service]();
    }
    if (service === 'combined') {
      var serviceNames = Object.keys(services);
      var pendingRequests = {};
      serviceNames.forEach(function(serviceName) {
        pendingRequests[serviceName] = false;
        services[serviceName](pendingRequests);
      });

      var length = serviceNames.length;
      var intervalTimeout = 500;
      var timeout = 40 * intervalTimeout; // 20 seconds
      var passedTime = 0;
      var interval = setInterval(function() {
        passedTime += intervalTimeout;
        for (var i = 0; i < length; i++) {
          if (passedTime >= timeout) {
            if (GLOBAL_config.DEBUG) { console.log('Timeout'); }
            break;
          }
          if (pendingRequests[serviceNames[i]] === false) {
            return;
          }
        }
        clearInterval(interval);
        var results = pendingRequests;
        collectResults(results, 'combined', false);
        pendingRequests = {};
      }, intervalTimeout);
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = mediaFinder;
} else {
  return mediaFinder;
}