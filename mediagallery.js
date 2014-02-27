'use strict';

var mediaFinder = require('./mediafinder.js');
var jsdom = require('jsdom').jsdom;
var Canvas = require('canvas');
var Image = Canvas.Image;
var request = require('request');
var Histogram = require('./histogram.js');
var Twitter = require('node-twitter');

var twitterRestClient = new Twitter.RestClient(
  process.env.MEDIA_GALLERY_API_KEY,
  process.env.MEDIA_GALLERY_API_SECRET,
  process.env.MEDIA_GALLERY_ACCESS_TOKEN,
  process.env.MEDIA_GALLERY_ACCESS_TOKEN_SECRET
);
var recentTweetsBuffer = [];

var window = jsdom().createWindow();
var document = window.document;

var illustrator = {
  bwTolerance: 1,
  cols: 10,
  rows: 10,
  minAge: 0,
  maxAge: 1 * 24 * 60 * 60 * 1000, // 1 day
  threshold: 15,
  similarTiles: 67,
  considerFaces: false,
  weights: {
    likes: 2,
    shares: 4,
    comments: 8,
    views: 1,
    crossNetwork: 32,
    recency: 2
  },
  mediaGallerySize: 15,
  mediaGalleryWidth: 999,
  mediaGalleryMargin: 4,
  mediaGalleryFontSize: 8,
  mediaItemHeight: 166,

  canvas: null,
  ctx: null,
  faviconCache: {},

  searchMediaItems: function(searchTerms, callback) {
    var mediaItems = {};
    var clusters = [];
    illustrator.canvas = new Canvas(100, 100);
    illustrator.ctx = illustrator.canvas.getContext('2d');
    illustrator.ctx.patternQuality = 'best';
    illustrator.ctx.filter = 'best';
    illustrator.ctx.antialias = 'subpixel';

    var returnSearchResults = function(searchResultsDelivered) {
      for (var term in searchResultsDelivered) {
        // not all search requests finished yet
        if (searchResultsDelivered[term] === false) {
          return false;
        }
      }
      // all search requests finished
      // used to only insert unique media items
      var containsMediaItem = function(source, micropostUrl) {
        for (var i = 0, len = source.length; i < len; i++) {
          if (source[i].micropostUrl === micropostUrl) {
            return true;
          }
        }
        return false;
      };
      // populate the final results object
      var result = {};
      for (var term in searchResultsDelivered) {
        for (var network in searchResultsDelivered[term]) {
          var subResults = searchResultsDelivered[term];
          if (!result[network]) {
            result[network] = [];
          }
          if (subResults[network]) {
            for (var i = 0, len = subResults[network].length; i < len; i++) {
              var mediaItem = subResults[network][i];
              if (!containsMediaItem(result[network], mediaItem.micropostUrl)) {
                result[network].push(mediaItem);
              }
            }
          }
        }
      }
      illustrator.retrieveMediaItems(result, mediaItems, clusters, searchTerms,
          callback);
    };

    var searchResultsDelivered = {};
    /* jshint maxlen:false */
    var userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/27.0.1453.116 Safari/537.36';
      /* jshint maxlen:80 */
    for (var term in searchTerms) {
      // needed to see if all social networks have returned results
      searchResultsDelivered[term] = false;
      (function(current) {
        mediaFinder.search('combined', current, userAgent, function(result) {
          var unquotedTerm = current.replace(/^"/, '').replace(/"$/, '');
          searchResultsDelivered[unquotedTerm] = result;
          returnSearchResults(searchResultsDelivered);
        });
      })('"' + term + '"');
    }
  },

  retrieveMediaItems: function(results, mediaItems, clusters, searchTerms,
      callback) {
    var checkMediaItemStatuses = function(target) {
      for (var key in mediaItems) {
        if (mediaItems[key].status !== target) {
          return false;
        }
      }
      return true;
    };

    var preloadImage = function(src, success, error) {
      request.get({url: src, encoding: null}, function(err, response, body) {
        if (err || response.statusCode !== 200) {
          return error(src);
        }
        var image = new Image();
        try {
          image.src = new Buffer(body, 'binary');
          return success(image);
        } catch(e) {
          return error(src);
        }
      });
    };

    var preloadFullImage = function(posterUrl) {
      // for photos, load the media url as full image
      // for videos, load the (already cached) thumbnail as full image
      var mediaUrl = posterUrl;
      if (mediaItems[posterUrl].type === 'photo') {
        mediaUrl = mediaItems[posterUrl].mediaUrl;
      }
      preloadImage(
          mediaUrl,
          function(image) {
            successFullImage(image, posterUrl);
          },
          function() {
            errorFullImage(posterUrl);
          });
    };

    var successThumbnail = function(image, posterUrl) {
      if (!illustrator.calculateHistograms(image, posterUrl, mediaItems)) {
        errorThumbnail(posterUrl);
      } else {
        preloadFullImage(posterUrl);
      }
    };

    var errorThumbnail = function(posterUrl) {
      delete mediaItems[posterUrl];
      if (checkMediaItemStatuses('loaded')) {
        illustrator.calculateDistances(mediaItems, clusters, searchTerms,
            callback);
      }
    };

    var successFullImage = function(image, posterUrl) {
      mediaItems[posterUrl].status = 'loaded';
      mediaItems[posterUrl].fullImage = {
        width: image.width,
        height: image.height,
        image: image
      };
      if (checkMediaItemStatuses('loaded')) {
        illustrator.calculateDistances(mediaItems, clusters, searchTerms,
            callback);
      }
    };

    var errorFullImage = function(posterUrl) {
      delete mediaItems[posterUrl];
      if (checkMediaItemStatuses('loaded')) {
        illustrator.calculateDistances(mediaItems, clusters, searchTerms,
            callback);
      }
    };

    var numResults = 0;
    for (var service in results) {
      results[service].forEach(function(item) {
        numResults++;
        item.origin = service;
        item.status = false;
        item.considerMediaItem = true;
        mediaItems[item.posterUrl] = item;
        var posterUrl = item.posterUrl;
        // load the poster url as thumbnail
        preloadImage(
          posterUrl,
          function(image) {
            successThumbnail(image, posterUrl);
          },
          errorThumbnail);
      });
    }
    if (numResults === 0) {
      return callback(false);
    }
  },

  calculateHistograms: function(img, posterUrl, mediaItems) {
    var canvasWidth = illustrator.canvas.width;
    var canvasHeight = illustrator.canvas.height;
    // clear the canvas
    illustrator.ctx.clearRect (0, 0, canvasWidth, canvasHeight);
    // draw the image on the canvas
    try {
      illustrator.ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
    } catch(e) {
      return false;
    }
    // calculate the histograms tile-wise
    var dw = ~~(canvasWidth / illustrator.cols);
    var dh = ~~(canvasHeight / illustrator.rows);

    mediaItems[posterUrl].tileHistograms = {};
    var len = illustrator.cols * illustrator.rows;
    for (var i = 0; i < len; i++) {
      // calculate the boundaries for the current tile from the
      // image and translate it to boundaries on the main canvas
      var mod = (i % illustrator.cols);
      var div = ~~(i / illustrator.cols);
      var dx = mod * dw;
      var dy = div * dh;
      // calculate the histogram of the current tile
      var histogram =
          Histogram.getHistogram(illustrator.ctx, dx, dy, dw, dh, false);
      mediaItems[posterUrl].tileHistograms[i] = {
        r: histogram.pixel.r,
        g: histogram.pixel.g,
        b: histogram.pixel.b
      };
    }
    img = null;
    return true;
  },

  calculateDistances: function(mediaItems, clusters, searchTerms, callback) {
    var keys = Object.keys(mediaItems);
    var len = keys.length;
    if (!len) {
      return callback(false);
    }
    var abs = Math.abs;
    // reset distances
    for (var i = 0; i < len; i++) {
      mediaItems[keys[i]].distances = {};
    }
    // commonly applied luminance factors
    var rFactor = 0.3;
    var gFactor = 0.59;
    var bFactor = 0.11;
    // black-and-white tolerance
    var blackTolerance = illustrator.bwTolerance;
    var whiteTolerance = 255 - illustrator.bwTolerance;

    for (var i = 0; i < len; i++) {
      var outer = keys[i];
      mediaItems[outer].distances = {};
      var outerHisto = mediaItems[outer].tileHistograms;
      for (var j = 0; j < len; j++) {
        if (j === i) {
          continue;
        }
        var inner = keys[j];
        var innerHisto = mediaItems[inner].tileHistograms;
        mediaItems[outer].distances[inner] = {};
        // recycle because of symmetry of distances:
        // dist(A<=>B) =  dist(B<=>A)
        if ((mediaItems[inner].distances) &&
           (mediaItems[inner].distances[outer])) {
          mediaItems[outer].distances[inner] =
              mediaItems[inner].distances[outer];
        // calculate new
        } else {
          for (var k in innerHisto) {
            var innerR = innerHisto[k].r;
            var innerG = innerHisto[k].g;
            var innerB = innerHisto[k].b;
            var outerR = outerHisto[k].r;
            var outerG = outerHisto[k].g;
            var outerB = outerHisto[k].b;
            if ((innerR >= blackTolerance &&
                innerG >= blackTolerance &&
                innerB >= blackTolerance) &&
               (outerR >= blackTolerance &&
                outerG >= blackTolerance &&
                outerB >= blackTolerance) &&
               (innerR <= whiteTolerance &&
                innerG <= whiteTolerance &&
                innerB <= whiteTolerance) &&
               (outerR <= whiteTolerance &&
                outerG <= whiteTolerance &&
                outerB <= whiteTolerance)) {
              mediaItems[outer].distances[inner][k] =
                  ~~((abs(rFactor * (innerR - outerR)) +
                      abs(gFactor * (innerG - outerG)) +
                      abs(bFactor * (innerB - outerB))) / 3);
            } else {
              mediaItems[outer].distances[inner][k] = null;
            }
          }
        }
      }
    }
    illustrator.filterForMinMaxAgeAndVisibility(mediaItems, clusters,
        searchTerms, callback);
  },

  filterForMinMaxAgeAndVisibility: function(mediaItems, clusters, searchTerms,
      callback) {
    var now = Date.now();
    for (var key in mediaItems) {
      var mediaItem = mediaItems[key];
      if (mediaItem.timestamp > now) {
        mediaItem.considerMediaItem = true; // was: false
      }
      // perfect
      else if ((now - mediaItem.timestamp <= illustrator.maxAge) &&
               (now - mediaItem.timestamp >= illustrator.minAge)) {
        mediaItem.considerMediaItem = true;
      // too old or too young
      } else {
        mediaItem.considerMediaItem = false;
      }
    }
    illustrator.clusterMediaItems(mediaItems, clusters, searchTerms, callback);
  },

  clusterMediaItems: function(mediaItems, clusters, searchTerms, callback) {
    var calculateMinimumSimilarTiles = function() {
      return Math.ceil(illustrator.rows * illustrator.cols / 3);
    };
    // filter to only consider the, well, considered media items
    var keys = Object.keys(mediaItems).filter(function(key) {
      return mediaItems[key].considerMediaItem;
    });
    var len = keys.length;
    var minimumSimilarTiles = calculateMinimumSimilarTiles();
    // the actual clustering
    for (var i = 0; i < len; i++) {
      if (!keys[i]) {
        continue;
      }
      var outer = keys[i];
      keys[i] = false;
      var distanceToOuter = {};
      for (var j = 0; j < len; j++) {
        if (j === i) {
          continue;
        }
        var inner = keys[j];
        var similarTiles = 0;
        var nulls = 0;
        var distance = mediaItems[outer].distances[inner];
        for (var k in distance) {
          if (distance[k] !== null) {
            if (distance[k] <= illustrator.threshold) {
              similarTiles++;
            }
          } else {
            nulls++;
          }
        }
        var minimumRequired;
        var similarTilesWithoutNulls = illustrator.similarTiles - nulls;
        if (similarTilesWithoutNulls >= minimumSimilarTiles) {
          minimumRequired = similarTilesWithoutNulls;
        } else {
          minimumRequired = minimumSimilarTiles;
        }
        if (similarTiles >= minimumRequired) {
          if (!distanceToOuter[similarTiles]) {
            distanceToOuter[similarTiles] = [j];
          } else {
            distanceToOuter[similarTiles].push(j);
          }
        }
      }
      var members = [];
      Object.keys(distanceToOuter).sort(function(a, b) {
        return b - a;
      }).forEach(function(numSimilarTiles) {
        distanceToOuter[numSimilarTiles].forEach(function(key) {
          members.push(keys[key]);
          keys[key] = false;
        });
      });
      clusters.push({
        identifier: outer,
        members: members
      });
    }
    if (clusters.length === 0) {
      return callback(false);
    }
    illustrator.mergeClusterData(mediaItems, clusters, searchTerms, callback);
  },

  mergeClusterData: function(mediaItems, clusters, searchTerms, callback) {
    var calculateDimensions = function(mediaItem) {
      // always prefer video over photo, so set the dimensions of videos
      // to Infinity, which overrules even high-res photos
      return (mediaItem.type === 'video' ?
          Infinity :
          mediaItem.fullImage.width * mediaItem.fullImage.height);
    };

    clusters.forEach(function(cluster) {
      var mediaItem = mediaItems[cluster.identifier];
      var socialInteractions = mediaItem.socialInteractions;
      var likes = socialInteractions.likes;
      var shares = socialInteractions.shares;
      var comments = socialInteractions.comments;
      var views = socialInteractions.views;
      cluster.statistics = {
        likes: likes,
        shares: shares,
        comments: comments,
        views: views
      };
      cluster.timestamp = mediaItem.timestamp;
      var dimensions = calculateDimensions(mediaItem);

      cluster.members.forEach(function(url, i) {
        var member = mediaItems[url];
        var memberSocialInteractions = member.socialInteractions;
        likes += memberSocialInteractions.likes;
        shares += memberSocialInteractions.shares;
        comments += memberSocialInteractions.comments;
        views += memberSocialInteractions.views;
        var newDimensions = calculateDimensions(member);
        // we have a new cluster identifier
        if (newDimensions >= dimensions) {
          dimensions = newDimensions;
          var oldIdentifier = cluster.identifier;
          cluster.identifier = url;
          cluster.members[i] = oldIdentifier;
        }
        // always use the youngest cluster member's timestamp
        if (member.timestamp < cluster.timestamp) {
          cluster.timestamp = member.timestamp;
        }
      });
      cluster.statistics = {
        likes: likes,
        shares: shares,
        comments: comments,
        views: views
      };
    });
    illustrator.rankClusters(mediaItems, clusters, searchTerms, callback);
  },

  rankingFormulas: {
    popularity: {
      name: 'Popularity',
      func: function(a, b) {
        var now = Date.now();
        var getAgeFactor = function(timestamp) {
          /* 86400000 = 24 * 60 * 60 * 1000 */
          var ageInDays = Math.floor((now - timestamp) / 86400000);
          if (ageInDays <= 1) {
            return 8;
          } else if (ageInDays <= 2) {
            return 4;
          } else if (ageInDays <= 3) {
            return 2;
          } else {
            return 1;
          }
        };
        var weights = illustrator.weights;
        var combinedStatsA =
            weights.likes * a.statistics.likes +
            weights.shares * a.statistics.shares +
            weights.comments * a.statistics.comments +
            weights.views * a.statistics.views +
            weights.crossNetwork * a.members.length +
            weights.recency * getAgeFactor(a.timestamp);
        var combinedStatsB =
            weights.likes * b.statistics.likes +
            weights.shares * b.statistics.shares +
            weights.comments * b.statistics.comments +
            weights.views * b.statistics.views +
            weights.crossNetwork * b.members.length +
            weights.recency * getAgeFactor(b.timestamp);
        return combinedStatsB - combinedStatsA;
      }
    }
  },

  rankClusters: function(mediaItems, clusters, searchTerms, callback) {
    clusters.sort(illustrator.rankingFormulas.popularity.func);
    illustrator.createMediaGallery(mediaItems, clusters, 'strictOrder',
        searchTerms, callback);
    illustrator.createMediaGallery(mediaItems, clusters, 'looseOrder',
        searchTerms, callback);
  },

  createMediaGallery: function(mediaItems, clusters, algorithm, searchTerms,
        callback) {
    var selectedMediaItems = [];
    clusters.forEach(function(cluster, counter) {
      if (counter >= illustrator.mediaGallerySize) {
        return;
      }
      var mediaItem = mediaItems[cluster.identifier];
      selectedMediaItems.push(mediaItem);
    });
    clusters = null;
    illustrator.mediaGalleryAlgorithms[algorithm]
        .func(selectedMediaItems, mediaItems, algorithm, searchTerms, callback);
  },

  mediaGalleryAlgorithms: {
    strictOrder: {
      name: 'Strict order, equal size',
      func: function(selectedMediaItems, mediaItems, algorithm, searchTerms,
          callback) {
        if (selectedMediaItems.length === 0) {
          return callback(false);
        }
        // media gallery algorithm credits to
        // http://blog.vjeux.com/2012/image/-
        // image-layout-algorithm-google-plus.html
        var heights = [];
        var margin = illustrator.mediaGalleryMargin;
        var size = Math.round(illustrator.mediaGalleryWidth * 2/3);

        var calculateSizes = function(images) {
          var n = 0;
          /* jshint indent:false */
          w: while (images.length > 0) {
            /* jshint indent:2 */
            var slice;
            var h;
            for (var i = 1; i < images.length + 1; ++i) {
              slice = images.slice(0, i);
              h = getHeight(slice, size);
              if (h < illustrator.mediaItemHeight) {
                setHeight(slice, h);
                n++;
                images = images.slice(i);
                continue w;
              }
            }
            setHeight(slice, Math.min(illustrator.mediaItemHeight, h));
            n++;
            break;
          }
        };

        var getHeight = function(images, width) {
          width -= images.length * 4;
          var h = 0;
          for (var i = 0, len = images.length; i < len; ++i) {
            h += (images[i].getAttribute('data-width') /
                images[i].getAttribute('data-height'));
          }
          return (width / h);
        };

        var setHeight = function(images, height) {
          heights.push(height);
          for (var i = 0, len = images.length; i < len; ++i) {
            var width = (height * images[i].getAttribute('data-width') /
                images[i].getAttribute('data-height'));
            images[i].style.width = Math.round(width) + 'px';
            images[i].style.height = Math.round(height) + 'px';
            images[i].firstChild.firstChild.style.width =
                Math.round(width) + 'px';
            images[i].firstChild.firstChild.style.height =
                Math.round(height) + 'px';
          }
        };

        var fragment = document.createDocumentFragment();
        var divs = [];
        selectedMediaItems.forEach(function(item) {
          var div = document.createElement('div');
          fragment.appendChild(div);
          div.setAttribute('class', 'mediaItem photoBorder');
          div.setAttribute('data-posterurl', item.posterUrl);
          div.setAttribute('data-faviconurl',
              item.origin.toLowerCase() + '.png');
          var anchor = document.createElement('a');
          anchor.href = item.micropostUrl;
          anchor.setAttribute('target', '_newtab');
          var img = document.createElement('img');
          if (item.type === 'photo') {
            img.src = item.mediaUrl;
          } else {
            img.src = item.posterUrl;
          }
          div.setAttribute('data-width', item.fullImage.width);
          div.setAttribute('data-height', item.fullImage.height);
          div.setAttribute(
              'style',
              'position:relative !important; float:left !important;');
          anchor.appendChild(img);
          div.appendChild(anchor);
          var favicon = document.createElement('img');
          favicon.setAttribute('class', 'favicon');
          favicon.src = item.origin.toLowerCase() + '.png';
          div.appendChild(favicon);
          divs.push(div);
        });
        var mediaGallery = document.createElement('div');
        var container = document.createElement('div');
        mediaGallery.appendChild(fragment);
        container.appendChild(mediaGallery);
        calculateSizes(divs);
        var height = heights.reduce(function(a, b) {
          return a + b + 2 * margin;
        }, 0);
        mediaGallery.style.height = Math.round(height + 10) + 'px';
        var width = 0;
        for (var i = 0, lenI = divs.length; i < lenI; i++) {
          var currentWidth =
              parseInt(divs[i].style.width.replace('px', ''), 10);
          if (width < size - currentWidth - i * margin) {
            width += currentWidth;
          } else {
            if (i < lenI) {
              width = size + margin;
            }
            width += margin;
            break;
          }
        }
        mediaGallery.style.width = width + 'px';
        illustrator.createMediaGalleryDump(mediaItems, divs, width, height,
            algorithm, searchTerms);
        selectedMediaItems = null;
        return callback(container.innerHTML);
      }
    },

    looseOrder: {
      name: 'Loose order, varying size',
      func: function(selectedMediaItems, mediaItems, algorithm, searchTerms,
          callback) {
        if (selectedMediaItems.length === 0) {
          return callback(false);
        }
        // media gallery algorithm credits to
        // http://blog.vjeux.com/2012/image/-
        // image-layout-algorithm-facebook.html
        var heights = [];
        var columnSize = illustrator.mediaItemHeight;
        var size = illustrator.mediaGalleryWidth;
        var margin = illustrator.mediaGalleryMargin;

        var createColumns = function(n) {
          for (var i = 0; i < n; ++i) {
            heights[i] = 0;
          }
        };

        var getMinColumn = function() {
          var minHeight = Infinity;
          var iMin = -1;
          for (var i = 0, len = heights.length; i < len; ++i) {
            if (heights[i] < minHeight) {
              minHeight = heights[i];
              iMin = i;
            }
          }
          return iMin;
        };

        var addColumnDiv = function(i, div, isBig) {
          var width = isBig ? columnSize * 2 + margin : columnSize;
          var height = isBig ? columnSize * 2 + margin : columnSize;
          div.setAttribute('style',
              'margin-left:' + (margin + (columnSize + margin) * i) + 'px; ' +
              'margin-top:' + ((columnSize + margin) *
              heights[Math.floor(i / 2)]) + 'px; ' +
              'height:' + height + 'px; ' +
              'width:' + width + 'px;');
          var mediaItem = div.firstChild.firstChild;
          var mediaItemWidth = parseInt(mediaItem.width, 10);
          var mediaItemHeight = parseInt(mediaItem.height, 10);
          var aspectRatio = mediaItemWidth / mediaItemHeight;
          var min = Math.min(mediaItemHeight, mediaItemWidth);
          if (min === mediaItemWidth) {
            mediaItem.style.width = width + 'px';
            mediaItem.style.height = (width / aspectRatio) + 'px';
          } else {
            mediaItem.style.height = height + 'px';
            mediaItem.style.width = (height * aspectRatio) + 'px';
          }
        };

        var calculateSizes = function(divs) {
          var nColumns = Math.floor(size / (2 * (columnSize + margin)));
          createColumns(nColumns);

          var smallDivs = [];
          var column;
          for (var i = 0, len = divs.length; i < len; ++i) {
            var div = divs[i];
            column = getMinColumn();
            var posterUrl = div.getAttribute('data-posterurl');
            var mediaItem = mediaItems[posterUrl];
            var resolutionGoodEnough =
                (mediaItem.fullImage.width * mediaItem.fullImage.height) >
                (illustrator.mediaItemHeight * illustrator.mediaItemHeight) ?
                    true : false;
            var isBig = (Math.random() > 0.7) && (resolutionGoodEnough);
            if (isBig) {
              addColumnDiv(column * 2, div, true);
              heights[column] += 2;
            } else {
              smallDivs.push(div);
              if (smallDivs.length === 2) {
                addColumnDiv(column * 2, smallDivs[0], false);
                addColumnDiv(column * 2 + 1, smallDivs[1], false);
                heights[column] += 1;
                smallDivs = [];
              }
            }
          }
          if (smallDivs.length) {
            column = getMinColumn();
            addColumnDiv(column * 2, smallDivs[0], false);
            heights[column] += 1;
          }
        };

        var fragment = document.createDocumentFragment();
        var divs = [];
        selectedMediaItems.forEach(function(item) {
          var div = document.createElement('div');
          div.setAttribute('class', 'mediaItem photoBorder');
          div.setAttribute('style', 'position:absolute; overflow:hidden;');
          div.setAttribute('data-posterurl', item.posterUrl);
          div.setAttribute('data-faviconurl',
              item.origin.toLowerCase() + '.png');

          var anchor = document.createElement('a');
          anchor.href = item.micropostUrl;
          anchor.setAttribute('target', '_blank');
          div.appendChild(anchor);

          var img = document.createElement('img');
          if (item.type === 'photo') {
            img.src = item.mediaUrl;
          } else {
            img.src = item.posterUrl;
          }
          img.width = item.fullImage.width;
          img.height = item.fullImage.height;
          anchor.appendChild(img);

          var favicon = document.createElement('img');
          favicon.setAttribute('class', 'favicon');
          favicon.src = item.origin.toLowerCase() + '.png';
          div.appendChild(favicon);
          divs.push(div);
        });

        var mediaGallery = document.createElement('div');
        calculateSizes(divs);
        divs.forEach(function(div) {
          fragment.appendChild(div);
        });
        mediaGallery.appendChild(fragment);
        var highestColumn = Math.max.apply(Math, heights);
        var height = highestColumn * (illustrator.mediaItemHeight + margin);
        var columnIndex = -1;
        while (heights[++columnIndex]) {
          // no op
        }
        /* jshint noempty:false */
        var width = 2 * columnIndex * (illustrator.mediaItemHeight + margin) +
            margin;
        mediaGallery.style.height = height + 'px';
        var container = document.createElement('div');
        container.appendChild(mediaGallery);
        illustrator.createMediaGalleryDump(mediaItems, divs, width, height,
            algorithm, searchTerms);
        selectedMediaItems = null;
        return callback(container.innerHTML);
      }
    }
  },

  createMediaGalleryDump: function(mediaItems, divs, width, height, algorithm,
      searchTerms) {
    var len = divs.length;
    var margin = illustrator.mediaGalleryMargin;
    var fontSize = illustrator.mediaGalleryFontSize;
    var canvas = new Canvas(width, height + 25 + len * (fontSize + 3));
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    var marginLeft = margin;
    var marginTop = margin;
    var imagesPerRow = 0;
    for (var i = 0; i < len; i++) {
      imagesPerRow++;
      var parentDiv = divs[i];
      var posterUrl = parentDiv.getAttribute('data-posterurl');
      var faviconUrl = parentDiv.getAttribute('data-faviconurl');
      var imageWidth = parseInt(parentDiv.style.width.replace('px', ''), 10);
      var imageHeight = parseInt(parentDiv.style.height.replace('px', ''), 10);
      var dw = imageWidth;
      var dh = imageHeight;
      var dx = parseInt(parentDiv.style.marginLeft.replace('px', ''), 10) ||
          marginLeft;
      var dy = parseInt(parentDiv.style.marginTop.replace('px', ''), 10) ||
          marginTop;
      var img = mediaItems[posterUrl].fullImage.image;
      if (marginLeft < width - imageWidth - imagesPerRow * margin) {
        marginLeft += imageWidth + margin;
      } else {
        marginLeft = 0;
        imagesPerRow = 0;
        marginTop += imageHeight + margin;
      }
      var sw;
      var sh;
      var aspectRatio = img.width / img.height;
      if (aspectRatio > 1 /* landscape */) {
        sw = img.height;
        sh = img.height;
      } else {
        sw = img.width;
        sh = img.width;
      }
      try {
        ctx.drawImage(img, 0, 0, sw, sh, dx, dy + margin, dw, dh);
      } catch(e) {
        return console.log('Canvas error ' + e);
      }
      img = null;
      var favicon;
      if (!illustrator.faviconCache[faviconUrl]) {
        favicon = new Image();
        favicon.src = __dirname + '/static/' + faviconUrl;
        illustrator.faviconCache[faviconUrl] = favicon;
      } else {
        favicon = illustrator.faviconCache[faviconUrl];
      }
      try {
        ctx.drawImage(favicon, dx + 5, dy + margin + 5);
      } catch(e) {
        return console.log('Canvas error ' + e);
      }
      favicon = null;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(dx + 1, dy + margin + 1, dw - 1, dh - 1);
      var micropostUrl = mediaItems[posterUrl].micropostUrl;
      ctx.strokeStyle = 'white';
      ctx.fillStyle = 'black';
      ctx.lineWidth = 3;
      ctx.font = fontSize + 'pt Helvetica';
      var index = i + 1;
      ctx.strokeText(index, dx + 23, dy + margin + 16, dw - 1);
      ctx.fillText(index, dx + 23, dy + margin + 16, dw - 1);
      ctx.fillText('[' + index + '] Source: ' + micropostUrl, margin,
          height + 5 * margin + i * (fontSize + 3), width);
    }
    canvas.toBuffer(function(err, buf) {
      var fileName = __dirname + '/mediagalleries/mediagallery_' +
          algorithm + '_' + Object.keys(searchTerms)
            .filter(function(term) {
              return !/^http:\/\//.test(term);
            })[0].replace(/\s/g, '_').replace(/\//g, '_') +
          '_' + Date.now() + '.png';
      require('fs').writeFile(fileName, buf, function(err) {
        if (err) {
          return console.log('File write error: "' + fileName + '". Error: ' +
              err);
        }
        var url = Object.keys(searchTerms).filter(function(term) {
          return /^https?:\/\//.test(term);
        })[0];
        // if we have already tweeted the current URL, don't tweet it again
        if (recentTweetsBuffer.indexOf(url) !== -1) {
          console.log('Already tweeted media gallery about ' + url);
          return;
        }
        // keep the recent tweets buffer at most 10 elements long
        recentTweetsBuffer.push(url);
        if (recentTweetsBuffer.length > 10) {
          recentTweetsBuffer.shift();
        }
        twitterRestClient.statusesUpdateWithMedia({
            'status': '#BreakingNews candidate via @WikiLiveMon: ' + url +
                ', ',
            'media[]': fileName.replace(/^~/g, '/Users/tsteiner')
          },
          function(error, result) {
            if (error) {
              console.log('Error: ' + (error.code ? error.code + ' ' +
                  error.message : error.message));
            }
            if (result) {
              console.log(result);
            }
          }
        );
      });
    });
    mediaItems = null;
  }
};

module.exports = illustrator.searchMediaItems;