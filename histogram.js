'use strict';

var Histogram = (function() {
  return {
    getHistogram: function(
        ctx, opt_x, opt_y, opt_width, opt_height, opt_values) {
      var x = opt_x || 0;
      var y = opt_y || 0;
      var w = opt_width || ctx.canvas.width;
      var h = opt_height || ctx.canvas.height;
      var returnValues = opt_values || false;
      // Core bits adapted from
      // https://github.com/jseidelin/pixastic/blob/master/actions/histogram.js
      var values = [];
      if (returnValues) {
        for (var i = 0; i < 256; i++) {
          values[i] = 0;
        }
      }
      var data = ctx.getImageData(x, y, w, h).data;
      var p = w * h;
      var q = p;
      var pix = p * 4;
      var round = Math.round;
      var avg = {
        r: 0,
        g: 0,
        b: 0
      };
      while (p--) {
        var r = data[pix -= 4];
        var g = data[pix + 1];
        var b = data[pix + 2];
        avg.r += r;
        avg.g += g;
        avg.b += b;
        if (returnValues) {
          values[round((r * 0.3 + g * 0.59 + b * 0.11) / 3)]++;
        }
      }
      var r = ~~(avg.r / q);
      var g = ~~(avg.g / q);
      var b = ~~(avg.b / q);
      if (returnValues) {
        return {
          values: values,
          pixel: {
            r: r,
            g: g,
            b: b
          },
          average: round((r + g + b) / 3),
          css: 'rgb(' + r + ',' + g + ',' + b + ')'
        };
      } else {
        return {
          pixel: {
            r: r,
            g: g,
            b: b
          },
          average: round((r + g + b) / 3),
          css: 'rgb(' + r + ',' + g + ',' + b + ')'
        };
      }
    }
  };
})();

module.exports = Histogram;