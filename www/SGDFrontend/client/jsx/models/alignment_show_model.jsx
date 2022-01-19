'use strict';

var _ = require('underscore');
var BaseModel = require('./base_model.jsx');

var REFERENCE_DISPLAY_NAME = 'S288C';

module.exports = class AlignmentShowModel extends BaseModel {
  constructor(options) {
    // add strain id segment to url if strainIds defined
    var strainIdUrlSegment = '';
    if (options.strainIds) {
      strainIdUrlSegment = _.reduce(
        options.strainIds,
        (memo, d) => {
          return memo + 'strain_id=' + d.toString() + '&';
        },
        ''
      );
    }
    options.url =
      options.url ||
      '/backend/alignments/' +
        options.id +
        '?' +
        strainIdUrlSegment +
        'callback=?';

    super(options);
  }

  // cache from local storage, otherwise normal fetch
  fetch(callback) {
    var storageKey = this.url;
    var maybeCachedResponse = JSON.parse(localStorage.getItem(storageKey));

    // cached data available, use
    if (maybeCachedResponse) {
      this.attributes = maybeCachedResponse;
      callback(null, maybeCachedResponse);
      // not in cache, fetch and set for next time
    } else {
      super.fetch((err, resp) => {
        callback(err, resp);
        localStorage.setItem(storageKey, JSON.stringify(resp));
      });
    }
  }

  parse(response) {
    response.strand = '+'; // force to render as crick strand
    response.aligned_protein_sequences = this._sortSequencesByStrain(
      response.aligned_protein_sequences
    );
    response.aligned_dna_sequences = this._sortSequencesByStrain(
      response.aligned_dna_sequences
    );
    return response;
  }

  canShowSequence(isProtein) {
    var attr = this.attributes;
    if (isProtein) {
      return (
        attr.aligned_protein_sequences.length > 1 &&
        attr.variant_data_protein.length > 0
      );
    } else {
      return (
        attr.aligned_dna_sequences.length > 1 &&
        attr.variant_data_dna.length > 0
      );
    }
  }

  _sortSequencesByStrain(sequences) {
    return _.sortBy(sequences, (d) => {
      return d.strain_display_name === REFERENCE_DISPLAY_NAME ? 1 : 2;
    });
  }

  getLocusDiagramData(isProtein) {
    var attr = this.attributes;
    var _start = Math.min(attr.coordinates.start, attr.coordinates.end);
    var _end = isProtein
      ? _start + attr.protein_length * 3
      : Math.max(attr.coordinates.start, attr.coordinates.end);

    // expand domain by 10% on each end to give some space around locus
    var _padding = Math.abs(_end - _start) * 0.1;
    var _domainBounds = [_start - _padding, _end + _padding];
    var _loci = [
      {
        start: _start,
        end: _end,
        track: attr.strand === '+' ? 1 : -1,
        locus: {
          display_name: attr.display_name,
          link: attr.link,
        },
      },
    ];
    var _contigData = attr.contig;
    _contigData.centromerePosition =
      (_contigData.centromere_start + _contigData.centromere_end) / 2;

    return {
      data: { locci: _loci },
      domainBounds: _domainBounds,
      contigData: _contigData,
      start: _start,
      end: _end,
    };
  }

  // pure function that returns true or false if two segments overlap
  _isOverlap(segA, segB) {
    var _isBefore = segA.end >= segB.start && segA.start <= segB.end + 1;
    var _isAfter = segA.start <= segB.end + 1 && segA.end >= segB.start;
    var _isSame = segA === segB;
    return (_isBefore || _isAfter) && !_isSame;
  }

  // from start and end of aligned sequence, return reference coordinates (currently always S288C)
  getReferenceCoordinatesFromAlignedCoordinates(
    alignedStart,
    alignedEnd,
    isProtein
  ) {
    var _attr = this.attributes;
    var _seqs = isProtein
      ? _attr.aligned_protein_sequences
      : _attr.aligned_dna_sequences;
    var referenceSequence = _.findWhere(_seqs, {
      strain_display_name: REFERENCE_DISPLAY_NAME,
    }).sequence;
    var refDomain = referenceSequence.split('').reduce(
      (memo, next, i) => {
        // only edit memo if this character isn't a gap
        if (next !== '-') {
          if (i < alignedStart) {
            memo.start += 1;
          }
          if (i < alignedEnd) {
            memo.end += 1;
          }
        }
        return memo;
      },
      { start: 0, end: 0 }
    );
    if (isProtein) {
      refDomain.start = refDomain.start * 3;
      refDomain.end = refDomain.end * 3;
    }
    return refDomain;
  }

  // format variant data for locus diagram
  getVariantData(isProtein) {
    var _rawVariantData = isProtein
      ? this.attributes.variant_data_protein
      : this.attributes.variant_data_dna;
    var _start = this.attributes.coordinates.start;
    var _end = this.attributes.coordinates.end;
    var _offset = isProtein ? 3 : 1;
    return _.map(_rawVariantData, (d) => {
      var _refCoord = this.getReferenceCoordinatesFromAlignedCoordinates(
        d.start,
        d.end,
        isProtein
      );
      if (this.attributes.strand === '+') {
        d.coordinateDomain = [
          _refCoord.start + _start - _offset,
          _refCoord.end + _start - _offset,
        ];
      } else {
        d.coordinateDomain = [
          _end - _refCoord.end + _offset,
          _end - _refCoord.start + _offset,
        ];
      }
      return d;
    });
  }

  _mergeOrAddSegment(existingSegments, newSegment) {
    var old;
    for (var i = existingSegments.length - 1; i >= 0; i--) {
      old = existingSegments[i];
      if (this._isOverlap(old, newSegment)) {
        old.start = Math.min(old.start, newSegment.start);
        old.end = Math.max(old.end, newSegment.end);
        return existingSegments;
      }
    }

    existingSegments.push(_.extend(newSegment, { visible: true }));
    return existingSegments;
  }

  // from raw variant data, produce segments as expected by multi_alignment_viewer
  formatSegments(isProtein) {
    var variants = isProtein
      ? this.attributes.variant_data_protein
      : this.attributes.variant_data_dna;
    var sequences = isProtein
      ? this.attributes.aligned_protein_sequences
      : this.attributes.aligned_dna_sequences;
    // make sure they're sorted by start
    variants = _.sortBy(variants, (d) => {
      return d.start;
    });

    // merge segments
    var mergedSegments = _.reduce(
      variants,
      (memo, d) => {
        return this._mergeOrAddSegment(memo, d);
      },
      []
    );

    // add in needed summarized segments
    // first one
    if (mergedSegments[0].start > 1) {
      mergedSegments.push({
        visible: false,
        start: 1,
        end: mergedSegments[0].start,
      });
    }
    // loop through and connect visible segments with summarized segments
    var _visibleSegments = _.where(mergedSegments, { visible: true });
    _visibleSegments.forEach((d, i) => {
      // must not be last or visible
      if (d.visible && i < _visibleSegments.length - 1) {
        mergedSegments.push({
          visible: false,
          start: d.end,
          end: _visibleSegments[i + 1].start,
        });
      }
    });

    var _last = _.max(mergedSegments, (d) => {
      return d.end;
    });
    var _maxLength = _.max(sequences, (d) => {
      return d.sequence.length;
    }).sequence.length;
    // add last if last segment is visible and not at the end
    if (_last.end < _maxLength) {
      mergedSegments.push({
        start: _last.end,
        end: _maxLength,
        visible: false,
      });
      // add last if visible
    } else {
      mergedSegments.push({
        start: _last.end,
        end: _maxLength + 1,
        visible: true,
      });
    }

    // change starts and ends to domains
    mergedSegments = _.map(mergedSegments, (d) => {
      d.domain = [d.start, d.end];
      return d;
    });
    // sort
    mergedSegments = _.sortBy(mergedSegments, (d) => {
      return d.start;
    });
    return mergedSegments;
  }

  formatSequences(isProtein, sequenceIds) {
    // return all strains if sequenceIds undefined
    var hasNoSequenceIds = sequenceIds === undefined;
    var _baseArray = isProtein
      ? this.attributes.aligned_protein_sequences
      : this.attributes.aligned_dna_sequences;
    _baseArray = _.filter(_baseArray, (d) => {
      if (hasNoSequenceIds) return true;
      return sequenceIds.indexOf(d.strain_id) > -1;
    });
    return _.map(_baseArray, (d) => {
      return {
        name: d.strain_display_name,
        href: d.strain_link,
        sequence: d.sequence,
      };
    });
  }
};
