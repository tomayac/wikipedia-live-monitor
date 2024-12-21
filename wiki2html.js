'use strict';

/* jshint maxlen:false */
/*
  @author: remy sharp / https://remysharp.com
  @url: https://remysharp.com/2008/04/01/wiki-to-html-using-javascript/
  @license: Creative Commons License - ShareAlike https://creativecommons.org/licenses/by-sa/3.0/
  @version: 1.0

  Can extend String or be used stand alone - just change the flag at the top of the script.
*/

// the regex beast...
function wiki2html(s) {
  // lists need to be done using a function to allow for recusive calls
  function list(str) {
    return str.replace(/(?:(?:(?:^|\n)[\*#].*)+)/g, function (m) {
      // (?=[\*#])
      var type = m.match(/(^|\n)#/) ? 'OL' : 'UL';
      // strip first layer of list
      m = m.replace(/(^|\n)[\*#][ ]{0,1}/g, '$1');
      m = list(m);
      return (
        '<' +
        type +
        '><li>' +
        m.replace(/^\n/, '').split(/\n/).join('</li><li>') +
        '</li></' +
        type +
        '>'
      );
    });
  }

  return list(
    s
      /* BLOCK ELEMENTS */ .replace(
        /(?:^|\n+)([^# =\*<].+)(?:\n+|$)/gm,
        function (m, l) {
          if (l.match(/^\^+$/)) {
            return l;
          }
          return '\n<p>' + l + '</p>\n';
        }
      )

      .replace(/(?:^|\n)[ ]{2}(.*)+/g, function (m, l) {
        // blockquotes
        if (l.match(/^\s+$/)) {
          return m;
        }
        return '<blockquote>' + l + '</pre>';
      })

      .replace(/((?:^|\n)[ ]+.*)+/g, function (m) {
        // code
        if (m.match(/^\s+$/)) {
          return m;
        }
        return '<pre>' + m.replace(/(^|\n)[ ]+/g, '$1') + '</pre>';
      })

      .replace(/(?:^|\n)([=]+)(.*)\1/g, function (m, l, t) {
        // headings
        return '<h' + l.length + '>' + t + '</h' + l.length + '>';
      })

      /* INLINE ELEMENTS */ .replace(/'''(.*?)'''/g, function (m, l) {
        // bold
        return '<strong>' + l + '</strong>';
      })

      .replace(/''(.*?)''/g, function (m, l) {
        // italic
        return '<em>' + l + '</em>';
      })

      .replace(/[^\[](http[^\[\s]*)/g, function (m, l) {
        // normal link
        return '<a href="' + l + '">' + l + '</a>';
      })

      .replace(/[\[](http.*)[!\]]/g, function (m, l) {
        // external link
        var p = l.replace(/[\[\]]/g, '').split(/ /);
        var link = p.shift();
        return (
          '<a href="' + link + '">' + (p.length ? p.join(' ') : link) + '</a>'
        );
      })

      .replace(/\[\[(.*?)\]\]/g, function (m, l) {
        // internal link or image
        var p = l.split(/\|/);
        var link = p.shift();

        if (link.match(/^Image:(.*)/)) {
          // no support for images - since it looks up the source from the wiki db :-(
          return m;
        } else {
          return (
            '<a href="' + link + '">' + (p.length ? p.join('|') : link) + '</a>'
          );
        }
      })
  );
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = wiki2html;
} else {
  return wiki2html;
}
