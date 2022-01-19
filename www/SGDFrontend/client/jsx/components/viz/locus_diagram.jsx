import React from 'react';
import d3 from 'd3';
import _ from 'underscore';

const CalcWidthOnResize = require('../mixins/calc_width_on_resize.jsx');
const ChromosomeThumb = require('./chromosome_thumb.jsx');
const FlexibleTooltip = require('../widgets/flexible_tooltip.jsx');
const HelpIcon = require('../widgets/help_icon.jsx');
const StandaloneAxis = require('./standalone_axis.jsx');
const subFeatureColorScale = require('../../lib/locus_format_helper.jsx').subFeatureColorScale();
const VariantPop = require('./variant_pop.jsx');
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';

const AXIS_LABELING_HEIGHT = 24;
const HEIGHT = 17;
const POINT_WIDTH = 10;
const TRACK_SPACING = 10;
const MIN_BP_WIDTH = 200; // show at least 200 BP
// const MOUSE_CAPTURE_TIME = 500; // millis until scrollwhell events are captured

const LocusDiagram = createReactClass({
  mixins: [CalcWidthOnResize],

  displayName: 'LocusDiagram',
  propTypes: {
    contigData: PropTypes.any, // {}
    data: PropTypes.any, // { locci: [] }
    domainBounds: PropTypes.any, // [0, 100]
    hasControls: PropTypes.any,
    hasChromosomeThumb: PropTypes.any,
    highlightedRelativeCoordinates: PropTypes.any,
    ignoreMouseover: PropTypes.any,
    focusLocusDisplayName: PropTypes.any,
    relativeCoordinateAxis: PropTypes.any,
    proteinCoordinateAxis: PropTypes.any,
    showSubFeatures: PropTypes.any,
    showVariants: PropTypes.any,
    variantData: PropTypes.any, // [{ coordinateDomain: [20045, 20046] }, ...]
    crickTracks: PropTypes.any,
    watsonTracks: PropTypes.any,
    onSetScale: PropTypes.any,
    onVariantMouseOver: PropTypes.any,
  },

  getDefaultProps: function () {
    return {
      contigData: null, // {}
      data: null, // { locci: [] }
      domainBounds: null, // [0, 100]
      hasControls: true,
      hasChromosomeThumb: true,
      highlightedRelativeCoordinates: null,
      ignoreMouseover: false,
      focusLocusDisplayName: null,
      relativeCoordinateAxis: false,
      proteinCoordinateAxis: false,
      showSubFeatures: false,
      showVariants: false,
      variantData: [], // [{ coordinateDomain: [20045, 20046] }, ...]
      crickTracks: 1,
      watsonTracks: 1,
      mainStrain: null,
      onSetScale: function (start, end, xScale) {},
      onVariantMouseOver: function (start, end) {},
    };
  },

  getInitialState: function () {
    return {
      domain: this.props.domainBounds,
      DOMWidth: 355,
      mouseoverId: null,
      tooltipVisible: false,
      tooltipLeft: 0,
      tooltipTop: 0,
      tooltipTitle: null,
      tooltipData: null,
      tooltipHref: null,
      zoomEnabled: false,
    };
  },

  render: function () {
    var height = this._getHeight(
      this.props.watsonTracks,
      this.props.crickTracks
    );
    var _ticks = this.state.DOMWidth > 400 ? null : 3;
    var _domain = this.props.relativeCoordinateAxis
      ? this._getRelativeCoordDomain()
      : this._getScale().domain();
    var locciNodes = _.map(this.props.data.locci, (d, i) => {
      return this._getLocusNode(d, i);
    });
    var midlineNode =
      this.props.crickTracks > 0 ? (
        <line
          className="midpoint-marker"
          x1="0"
          x2={this.state.DOMWidth}
          y1={this._getMidpointY()}
          y2={this._getMidpointY()}
        />
      ) : null;

    return (
      <div
        ref={(wrapper) => (this.wrapper = wrapper)}
        className="locus-diagram"
        onMouseLeave={this._clearMouseOver}
        onClick={this._clearMouseOver}
      >
        {this._getControlsNode()}
        <div
          className="locus-diagram-viz-container"
          style={{ position: 'relative' }}
        >
          <FlexibleTooltip
            visible={this.state.tooltipVisible}
            left={this.state.tooltipLeft}
            top={this.state.tooltipTop}
            title={this.state.tooltipTitle}
            data={this.state.tooltipData}
            href={this.state.tooltipHref}
          />
          <div
            className="locus-diagram-axis-container"
            style={{ position: 'absolute', top: 0, width: '100%' }}
          >
            <StandaloneAxis
              domain={_domain}
              orientation="bottom"
              gridTicks={true}
              ticks={_ticks}
              height={height + AXIS_LABELING_HEIGHT}
              tickFormat={(d) => {
                return d;
              }}
            />
          </div>
          <svg
            ref={(svg) => (this.svg = svg)}
            className="locus-svg"
            onMouseEnter={this._onSVGMouseEnter}
            onMouseLeave={this._onSVGMouseLeave}
            style={{ width: '100%', height: height, position: 'relative' }}
          >
            {midlineNode}
            {this._getHighlightedSegmentNode()}
            {locciNodes}
            {this._getVariantNodes()}
          </svg>
        </div>
      </div>
    );
  },

  _getHeight: function (watsonTracks, crickTracks) {
    return (
      watsonTracks * (HEIGHT + TRACK_SPACING) +
      TRACK_SPACING +
      crickTracks * (HEIGHT + TRACK_SPACING) +
      TRACK_SPACING
    );
  },

  // Update width to that of real DOM.
  // If touch device, enable zoom
  componentDidMount: function () {
    this._isMounted = true;
    this._calculateWidth();
    if (Modernizr) {
      if (Modernizr.touch) {
        this.setState({ zoomEnabled: true });
      }
    }
  },

  componentWillUnmount() {
    this._isMounted = false;
  },

  componentDidUpdate: function (prevProps, prevState) {
    // If the width or zoomEnabled is updated, setup zoom events again.
    if (
      this.state.DOMWidth !== prevState.DOMWidth ||
      this.state.zoomEnabled !== prevState.zoomEnabled
    )
      this._setupZoomEvents();

    // If a new default domain (prob strain change, reset domain), and setup zoom events after 0.1 sec.
    if (this.props.domainBounds !== prevProps.domainBounds) {
      this.setState({ domain: this.props.domainBounds }); // don't use _setDomain to force it
      setTimeout(() => {
        if (this._isMounted) this._setupZoomEvents();
      }, 100);
    }
  },

  // enable zoom after 500 millis, unless it gets cancelled
  _onSVGMouseEnter: function () {
    this._timeout = setTimeout(() => {
      if (this._isMounted) this.setState({ zoomEnabled: true });
    }, 500);
  },

  // clear timeout, disable zoom, clear mouseover
  _onSVGMouseLeave: function () {
    if (this._timeout) clearTimeout(this._timeout);
    if (this.state.zoomEnabled) this.setState({ zoomEnabled: false });
  },

  // returns an svg 'g' element, with embedded shapes
  _getLocusNode: function (d, i) {
    // remove char codes from display name
    var dn = this.props.focusLocusDisplayName;
    var dislayNameWithoutCharCode;
    var charIndex = dn.indexOf('&#');
    if (charIndex < 0) {
      dislayNameWithoutCharCode = dn;
    } else {
      var charCode = parseInt(dn.substring(charIndex + 2, dn.length));
      dislayNameWithoutCharCode =
        dn.substring(0, charIndex) + String.fromCharCode(charCode);
    }
    var isFocusLocus = d.locus.display_name === dislayNameWithoutCharCode;

    if (this.props.showSubFeatures && d.tags.length) {
      return this._getLocusWithSubFeaturesNode(d, i, isFocusLocus);
    } else {
      return this._getSimpleLocusNode(d, i, isFocusLocus);
    }
  },

  _getLocusWithSubFeaturesNode: function (d, i, isFocusLocus) {
    var _transformX = this._getTransformObject(d).x;
    var _transform = `translate(${_transformX}, 0)`;
    var subFeatureNodes = this._getSubFeatureNodes(
      d.start,
      d.end,
      d.tags,
      d.strand === '+',
      isFocusLocus,
      _transformX
    );
    return (
      <g transform={_transform} key={'locusWithSubFeature' + i}>
        {subFeatureNodes}
      </g>
    );
  },

  _getSubFeatureNodes: function (
    chromStart,
    chromEnd,
    tags,
    isWatson,
    isFocusLocus,
    groupTransformX
  ) {
    var scale = this._getScale();

    // calc the last feature, to know where to draw arrow
    // var lastSubFeature = _.max(tags, (d) => {
    //   return d.relative_start;
    // });

    return _.map(tags, (d, i) => {
      var fill = subFeatureColorScale(d.class_type);

      var start = d.relative_start;
      var end = d.relative_end;

      // special treatment for crick strand features
      if (!isWatson) {
        var width = chromEnd - chromStart;
        var _start = width - end;
        var _end = width - start;
        start = _start;
        end = _end;
      }

      // scale relative starts to x scale
      var startX = scale(chromStart + start - 0.5) - scale(chromStart);
      var endX = scale(chromStart + end + 0.5) - scale(chromStart);

      // text node
      var _textX = startX + (endX - startX) / 2;
      var _textY = d.class_type === 'INTRON' ? 0 : HEIGHT - 4;
      var _textTransform = `translate(${_textX}, ${_textY})`;
      var _textFill = d.class_type === 'CDS' ? 'white' : 'black';
      var textNode = (
        <text transform={_textTransform} textAnchor="middle" fill={_textFill}>
          {d.display_name.replace(/_/g, ' ')}
        </text>
      );
      // hide text if too small
      var _approxWidth = d.display_name.length * 8;
      if (_approxWidth > endX - startX) textNode = null;

      // properties for all possible nodes
      var _transformY = this._getTransformObject(d).y;
      var groupTransform = `translate(0, ${_transformY})`;
      var opacity =
        d.id === this.state.mouseoverId || this.props.ignoreMouseover ? 1 : 0.8;

      // mouseover callback
      var mouseoverObj = _.clone(d);
      mouseoverObj.x = groupTransformX + startX;
      var handleMouseover = (e) => {
        this._handleMouseOver(e, mouseoverObj);
      };

      // assign node for shape based on data
      var shapeNode;
      // intron; line
      if (d.class_type === 'INTRON') {
        let pathString = `M${startX} ${HEIGHT / 2} C ${
          startX + (endX - startX) * 0.25
        } ${HEIGHT / 5}, ${startX + (endX - startX) * 0.75} ${
          HEIGHT / 5
        }, ${endX} ${HEIGHT / 2}`;
        shapeNode = (
          <path
            d={pathString}
            onMouseOver={handleMouseover}
            opacity={opacity}
            stroke="black"
            fill="none"
          />
        );
        // non-intron wide enough for trapezoid
      } else if (endX - startX > POINT_WIDTH) {
        let pathString = this._getTrapezoidStringPath(
          startX,
          endX,
          d.track > 0
        );
        shapeNode = (
          <path
            d={pathString}
            onMouseOver={handleMouseover}
            opacity={opacity}
            fill={fill}
          />
        );
        // too small for trapezoid, rectangle
      } else {
        shapeNode = (
          <rect
            onMouseOver={handleMouseover}
            opacity={opacity}
            x={startX}
            width={endX - startX}
            height={HEIGHT}
            fill={fill}
          />
        );
      }

      return (
        <g transform={groupTransform} key={'locusSubFeature' + i}>
          {shapeNode}
          {textNode}
        </g>
      );
    });
  },

  _getSimpleLocusNode: function (d, i, isFocusLocus) {
    var scale = this._getScale();
    var startX = scale(Math.min(d.start, d.end));
    var endX = scale(Math.max(d.start, d.end));

    var relativeStartX = 0;
    var relativeEndX = endX - startX;

    var pathString = this._getTrapezoidStringPath(
      relativeStartX,
      relativeEndX,
      d.track > 0
    );

    var focusKlass = isFocusLocus ? ' focus' : '';

    // text node
    var _approxWidth = d.locus.display_name.length * 8;
    let _onClick = (e) => {
      this._onLocusSelect(e, d);
    };
    var _textX = relativeEndX / 2;
    var _textY = HEIGHT - 4;
    var _textTransform = `translate(${_textX}, ${_textY})`;
    var _opacity =
      d.id === this.state.mouseoverId || this.props.ignoreMouseover ? 1 : 0.8;
    var textNode = (
      <text
        className={`locus-diagram-anchor${focusKlass}`}
        onClick={_onClick}
        transform={_textTransform}
        textAnchor="middle"
      >
        {d.locus.display_name}
      </text>
    );
    // hide text if too small
    if (_approxWidth > relativeEndX) textNode = null;

    // interaction handlers
    var _onMouseover = (e) => {
      this._handleMouseOver(e, d);
    };
    _onClick = (e) => {
      this._handleClick(e, d);
    };

    var shapeNode;
    // large enough for trapezoid
    if (endX - startX > POINT_WIDTH) {
      shapeNode = (
        <path
          className={`locus-node${focusKlass}`}
          d={pathString}
          opacity={_opacity}
          onClick={_onClick}
          onMouseOver={_onMouseover}
        />
      );
      // too small; rect
    } else {
      shapeNode = (
        <rect
          className={`locus-node${focusKlass}`}
          x={0}
          width={endX - startX}
          height={HEIGHT}
          opacity={_opacity}
          onClick={_onClick}
          onMouseOver={_onMouseover}
        />
      );
    }

    var _transform = this._getGroupTransform(d);
    return (
      <g transform={_transform} key={'simpleLocus' + i}>
        {shapeNode}
        {textNode}
      </g>
    );
  },

  // returns the transform string used to position the g element for a locus
  _getGroupTransform: function (d) {
    var obj = this._getTransformObject(d);
    return `translate(${obj.x}, ${obj.y})`;
  },

  // returns  transform x y coordinates
  _getTransformObject: function (d) {
    var scale = this._getScale();
    var _x = scale(Math.min(d.start, d.end));
    var _y = this._getMidpointY() - d.track * (HEIGHT + TRACK_SPACING);
    if (d.track < 0) _y -= HEIGHT;

    return {
      x: _x,
      y: _y,
    };
  },

  _getMidpointY: function () {
    return this.props.watsonTracks * (HEIGHT + TRACK_SPACING) + TRACK_SPACING;
  },

  // from relative start, relative end, and bool isWatson, return the string to draw a trapezoid
  _getTrapezoidStringPath: function (relativeStartX, relativeEndX, isWatson) {
    var pointWidth = Math.min(POINT_WIDTH, relativeEndX - relativeStartX);

    var points;
    if (isWatson) {
      points = [
        { x: relativeStartX, y: 0 },
        { x: relativeEndX - pointWidth, y: 0 },
        { x: relativeEndX, y: HEIGHT / 2 },
        { x: relativeEndX - pointWidth, y: HEIGHT },
        { x: relativeStartX, y: HEIGHT },
        { x: relativeStartX, y: 0 },
      ];
    } else {
      points = [
        { x: relativeStartX + pointWidth, y: 0 },
        { x: relativeEndX, y: 0 },
        { x: relativeEndX, y: HEIGHT },
        { x: relativeStartX + pointWidth, y: HEIGHT },
        { x: relativeStartX, y: HEIGHT / 2 },
      ];
    }

    var areaFn = d3.svg
      .line()
      .x((d) => {
        return d.x;
      })
      .y((d) => {
        return d.y;
      });

    return areaFn(points) + 'Z';
  },

  _calculateWidth: function () {
    var _width = this.wrapper.getBoundingClientRect().width;
    this.setState({ DOMWidth: _width });
    var _scale = d3.scale
      .linear()
      .domain(this.props.domainBounds)
      .range([0, _width]);
    this.props.onSetScale(_scale);
  },

  // Set the new domain; it may want some control in the future.
  _setDomain: function (newDomain) {
    this._clearMouseOver();

    // TEMP be more forgiving with new domain
    // don't let the new domain go outside domain bounds
    var _lb = Math.max(newDomain[0], this.props.domainBounds[0]);
    var _rb = Math.min(newDomain[1], this.props.domainBounds[1]);

    // make sure not TOO zoomed in
    if (_rb - _lb < MIN_BP_WIDTH) return;

    this.setState({
      domain: [_lb, _rb],
    });

    var _scale = this._getScale();
    this.props.onSetScale(_scale);
  },

  _handleMouseOver: function (e, d) {
    if (this.props.ignoreMouseover) return;

    // get the position
    var target = e.currentTarget;
    var _width = target.getBBox().width;
    var _transformObj = this._getTransformObject(d);
    var _tooltipLeft = Math.min(
      this.state.DOMWidth,
      (d.x || _transformObj.x) + _width / 2
    );
    _tooltipLeft = Math.max(5, _tooltipLeft);
    var _tooltipTop = _transformObj.y + HEIGHT / 3;
    var _tooltipData = this._formatTooltipData(d);

    this.setState({
      mouseoverId: d.id,
      tooltipData: _tooltipData.data,
      tooltipTitle: _tooltipData.title,
      tooltipHref: _tooltipData.href,
      tooltipVisible: true,
      tooltipLeft: _tooltipLeft,
      tooltipTop: _tooltipTop,
    });
  },

  _formatTooltipData: function (d) {
    var _title;
    if (d.locus) {
      _title =
        d.locus.display_name === d.locus.format_name
          ? d.locus.display_name
          : `${d.locus.display_name} (${d.locus.format_name})`;
    } else {
      _title = d.display_name.replace(/_/g, ' ');
    }

    // dynamic key value object
    var _data = {};
    if (d.locus) {
      var _qualText = d.qualifier ? ` (${d.qualifier})` : '';
      _data[d.locus.locus_type + _qualText] = d.locus.headline;
      // TODO add chrom number
      _data['Coordinates'] = `${d.start}..${d.end}`;
      _data['Length'] = d.end - d.start + 1 + ' bp';
    } else {
      _data['Relative Coordinates'] = `${d.relative_start} - ${d.relative_end}`;
      _data['Length'] = d.relative_end - d.relative_start + 1 + ' bp';
    }

    return {
      title: _title,
      data: _data,
      href: d.locus ? d.locus.link : null,
    };
  },

  _clearMouseOver: function () {
    this.setState({
      mouseoverId: null,
      tooltipVisible: false,
    });
  },

  _handleClick: function (e, d) {
    e.preventDefault();
    if (d.locus.link) {
      document.location = d.locus.link;
    }
  },

  _onLocusSelect: function (e, d) {
    e.preventDefault();
    document.location.href = d.locus.link;
  },

  _getScale: function () {
    return d3.scale
      .linear()
      .domain(this.state.domain)
      .range([0, this.state.DOMWidth]);
  },

  // Subtracts 10% to both sides of the chart.
  _zoomIn: function (e) {
    e.preventDefault();
    var domain = this.state.domain;
    var domainRange = domain[1] - domain[0];
    var domainDelta = domainRange * 0.1;
    this._setDomain([domain[0] + domainDelta, domain[1] - domainDelta]);
    this._setupZoomEvents();
  },

  // Adds 10% to both sides of the chart.
  _zoomOut: function (e) {
    e.preventDefault();
    var domain = this.state.domain;
    var domainRange = domain[1] - domain[0];
    var domainDelta = domainRange * 0.1;
    this._setDomain([domain[0] - domainDelta, domain[1] + domainDelta]);
    this._setupZoomEvents();
  },

  // left 10%
  _stepLeft: function (e) {
    e.preventDefault();
    var domain = this.state.domain;
    var domainRange = domain[1] - domain[0];
    var domainDelta = domainRange * 0.1;
    this._setDomain([domain[0] - domainDelta, domain[1] - domainDelta]);
    this._setupZoomEvents();
  },

  // right 10%
  _stepRight: function (e) {
    e.preventDefault();
    var domain = this.state.domain;
    var domainRange = domain[1] - domain[0];
    var domainDelta = domainRange * 0.1;
    this._setDomain([domain[0] + domainDelta, domain[1] + domainDelta]);
    this._setupZoomEvents();
  },

  // setup d3 zoom and pan behavior ()
  _setupZoomEvents: function () {
    var scale = this._getScale();
    var zoom = d3.behavior
      .zoom()
      .x(scale)
      .on('zoom', () => {
        this._setDomain(scale.domain());
      });
    var svg = d3.select(this.svg);
    // no zoom events if zoom enabled false
    if (!this.state.zoomEnabled) {
      zoom = () => {
        return null;
      };
      svg.on('.zoom', null);
    }
    svg.call(zoom);
  },

  // Get the controls if needed, and disable the right buttons.
  _getControlsNode: function () {
    var controlsNode = null;

    if (this.props.hasControls) {
      var stateDomain = this.state.domain;
      var propsDomain = this.props.domainBounds;

      var helpText =
        'With your cursor in the diagram, scroll up to zoom in, and scroll down to zoom out.  Once zoomed in, drag left or right to move to the side.  Hold the mouse over a feature for more information.';
      var leftDisabled = stateDomain[0] <= propsDomain[0];
      var leftDisabledClass = leftDisabled ? 'disabled secondary' : 'secondary';
      var rightDisabled = stateDomain[1] >= propsDomain[1];
      var rightDisabledClass = rightDisabled
        ? 'disabled secondary'
        : 'secondary';
      var stepLeft = leftDisabled ? null : this._stepLeft;
      var stepRight = rightDisabled ? null : this._stepRight;

      var outDisabled = leftDisabled && rightDisabled;
      var outDisabledClass = outDisabled ? 'disabled secondary' : 'secondary';
      var inDisabled = false;
      var inDisabledClass = inDisabled ? 'disabled secondary' : 'secondary';
      var zoomIn = inDisabled ? null : this._zoomIn;
      var zoomOut = outDisabled ? null : this._zoomOut;

      // chromosome reference labeling
      var chromThumb = this._getChromosomeThumb();

      controlsNode = (
        <div className="locus-diagram-control-container">
          <div className="row control-row">
            <div className="medium-8 columns">{chromThumb}</div>
            <div className="medium-4 columns end clearfix">
              <h3 style={{ display: 'inline-block', marginTop: 1 }}>
                <HelpIcon text={helpText} />
              </h3>
              <ul className="locus-diagram-button-group round button-group">
                <li>
                  <a
                    className={`tiny button ${leftDisabledClass}`}
                    onClick={stepLeft}
                  >
                    <i className="fa fa-backward"></i>
                  </a>
                </li>
                <li>
                  <a
                    className={`tiny button ${rightDisabledClass}`}
                    onClick={stepRight}
                  >
                    <i className="fa fa-forward"></i>
                  </a>
                </li>
              </ul>
              <ul className="locus-diagram-button-group round button-group">
                <li>
                  <a
                    className={`tiny button ${inDisabledClass}`}
                    onClick={zoomIn}
                  >
                    <i className="fa fa-plus"></i>
                  </a>
                </li>
                <li>
                  <a
                    className={`tiny button ${outDisabledClass}`}
                    onClick={zoomOut}
                  >
                    <i className="fa fa-minus"></i>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    return controlsNode;
  },

  _getChromosomeThumb: function () {
    var chromThumb = <span>&nbsp;</span>;
    // neighbor diagram with chrom thumb prop
    if (this.props.hasChromosomeThumb && !this.props.showSubFeatures) {
      chromThumb = (
        <ChromosomeThumb
          totalLength={this.props.contigData.length}
          domain={this.state.domain}
          centromerePosition={this.props.contigData.centromerePosition}
          isChromosome={this.props.contigData.isChromosome}
        />
      );
      // details diagram
    } else if (this.props.showSubFeatures) {
      var _subN = this.props.data.locci[0].tags.length;
      var _labelText = _subN > 1 ? 'subfeatures' : 'subfeature';
      chromThumb = (
        <h3 className="subfeature-label-text">
          Subfeatures - {this.props.mainStrain}
          <span className="round secondary label">
            {_subN} {_labelText}
          </span>
        </h3>
      );
    }

    return chromThumb;
  },

  _getHighlightedSegmentNode: function () {
    var _highCoord = this.props.highlightedRelativeCoordinates;
    if (!_highCoord) return null;

    var _locus = this._getFocusLocus();
    var scale = this._getScale();
    var startCoord = _locus.start + _highCoord[0];
    var endCoord = _locus.start + _highCoord[1];
    var _x = scale(startCoord);
    var _width = Math.abs(scale(endCoord) - scale(startCoord));

    return (
      <rect x={_x} width={_width} height="100" fill="#DEC113" opacity={0.5} />
    );
  },

  _getFocusLocus: function () {
    // require focus locus display name
    if (!this.props.focusLocusDisplayName) return false;

    var _locci = this.props.data.locci;
    return _.filter(_locci, (d) => {
      return d.locus.display_name === this.props.focusLocusDisplayName;
    })[0];
  },

  _getVariantNodes: function () {
    if (this.props.variantData.length === 0 || !this.props.showVariants) {
      return null;
    }

    var focusLocus = this._getFocusLocus();
    var scale = this._getScale();
    var yCoordinate = this._getTransformObject(focusLocus).y - HEIGHT;
    return _.map(this.props.variantData, (d, i) => {
      return (
        <VariantPop
          data={d}
          onMouseOver={this.props.onVariantMouseOver}
          scale={scale}
          y={yCoordinate}
          key={'variantNode' + i}
        />
      );
    });
  },

  _getRelativeCoordDomain: function () {
    var locus = this._getFocusLocus();
    var leftOffset = this.props.domainBounds[0] - locus.start;
    var rightOffset = this.props.domainBounds[1] - locus.start;
    if (this.props.proteinCoordinateAxis) {
      leftOffset = leftOffset / 3;
      rightOffset = rightOffset / 3;
    }
    return locus.track > 0
      ? [leftOffset, rightOffset]
      : [rightOffset, leftOffset];
  },
});

module.exports = LocusDiagram;
