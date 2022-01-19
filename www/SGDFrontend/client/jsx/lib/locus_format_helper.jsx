'use strict';

var _ = require('underscore');
var d3 = require('d3');

var WATSON_TRACKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
var CRICK_TRACKS = [-1, -2, -3, -4, -5, -6, -7, -8, -9, -10];

module.exports = {
  // For the given locus, assign a track higher than overlaps. return locus, with track assigned
  assignTrackToSingleLocus: function (locus, locci) {
    var isWatsonFn = (strand) => {
      return strand === '+';
    };
    var isWatson = isWatsonFn(locus.strand);
    var availableTracks = isWatson ? WATSON_TRACKS : CRICK_TRACKS;

    var defaultTrackNum = isWatson ? 1 : -1;

    // get the overlaps
    var overlaps = _.filter(locci, (d) => {
      if (isWatsonFn(d.strand) !== isWatsonFn(locus.strand)) return false;
      if (d.start >= locus.end || d.end <= locus.start) return false;
      return true;
    });

    // find the current max overlap, if it exists
    // var maxOverlap;
    // var minOverlap;
    // if (isWatson) {
    // 	maxOverlap = _.max(overlaps, d => { return d.track }).track;
    // 	minOverlap = _.min(overlaps, d => { return d.track }).track;
    // } else {
    // 	maxOverlap = _.min(overlaps, d => { return d.track }).track;
    // 	minOverlap = _.max(overlaps, d => { return d.track }).track;
    // }

    // see which tracks are not being used by overlaps
    var _temp = _.filter(
      _.map(overlaps, (d) => {
        return d.track;
      }),
      (e) => {
        return e;
      }
    );
    var _overlapTracks = _.uniq(_temp);
    availableTracks = _.difference(availableTracks, _overlapTracks);

    // get the min or max available track
    var track;
    if (isWatson) {
      track = _.min(availableTracks);
    } else {
      track = _.max(availableTracks);
    }
    // or default
    track = track || defaultTrackNum;

    locus.track = track;
    return locus;
  },

  // get the min and max track as d3-ish domain array [min, max]
  getTrackDomain: function (locci) {
    var min = -1;
    var max = 1;

    for (var i = locci.length - 1; i >= 0; i--) {
      min = Math.min(min, locci[i].track);
      max = Math.max(max, locci[i].track);
    }

    return [min, max];
  },

  formatContigData: function (contigData) {
    var _centromerePosition = null;
    contigData.is_chromosome =
      contigData.is_chromosome === 'undefined'
        ? false
        : contigData.is_chromosome;
    if (contigData.is_chromosome) {
      _centromerePosition =
        contigData.centromere_start && contigData.centromere_end
          ? (contigData.centromere_start + contigData.centromere_end) / 2
          : null;
    }

    return {
      name: contigData.display_name,
      formatName: contigData.format_name,
      href: contigData.link,
      isChromosome: contigData.is_chromosome,
      length: contigData.length || 250000, // TEMP default 250 kbp length
      centromerePosition: _centromerePosition,
    };
  },

  // returns a d3 ordinal scale with desired color scale for sub-feature types
  subFeatureColorScale: function () {
    var FEAUTRE_TYPES = [
      'CDS',
      'INTRON',
      'ARS',
      'ARS CONSENSUS SEQUENCE',
      'BINDING_SITE',
      'CDEI',
      'CDEII',
      'CDEIII',
      'CENTROMERE',
      'EXTERNAL_TRANSCRIBED_SPACER_REGION',
      'FIVE_PRIME_UTR_INTRON',
      'INSERTION',
      'INTERNAL_TRANSCRIBED_SPACER_REGION',
      'LONG_TERMINAL_REPEAT',
      'NON_TRANSCRIBED_REGION',
      'NONCODING_EXON',
      'ORF',
      'PLUS_1_TRANSLATIONAL_FRAMESHIFT',
      'PSEUDOGENE',
      'REPEAT_REGION',
      'RRNA',
      'SNORNA',
      'SNRNA',
      'TELOMERIC_REPEAT',
      'TRANSPOSABLE_ELEMENT_GENE',
      'TRNA',
      'W_REGION',
      'X_ELEMENT_COMBINATORIAL_REPEATS',
      'X_ELEMENT_CORE_SEQUENCE',
      'X_REGION',
      "Y'_ELEMENT",
      'Y_REGION',
      'Z1_REGION',
      'Z2_REGION',
    ];

    var colorScale = d3.scale.category20().domain(FEAUTRE_TYPES);
    var _cRange = colorScale.range();
    _cRange[0] = '#696599';
    _cRange[1] = 'red';
    colorScale = colorScale.range(_cRange);
    return colorScale;
  },
};
