'use strict';
var React = require('react');
var ReactDOM = require('react-dom');
var $ = require('jquery');

var ExpressionChart = require('../components/viz/expression_chart.jsx');

var expressionView = {};
expressionView.render = function (data) {
  if (data.datasets.length) {
    // use filter_table(minValue, maxValue) method from expression_details.js
    var _onClick = null;
    if (filter_table) {
      _onClick = (minValue, maxValue) => {
        filter_table(minValue, maxValue);
      };
    }

    ReactDOM.render(
      <ExpressionChart
        data={data.overview}
        minValue={data.min_value}
        maxValue={data.max_value}
        hasScaleToggler={true}
        onClick={_onClick}
        hasHelpIcon={true}
      />,
      document.getElementById('j-expression-chart-target')
    );
  } else {
    $('#expression_overview_panel').hide();
    $('#expression_message').show();
  }
};

module.exports = expressionView;
