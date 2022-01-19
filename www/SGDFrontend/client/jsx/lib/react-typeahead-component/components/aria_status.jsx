'use strict';

var React = require('react');
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';

module.exports = createReactClass({
  displayName: 'Aria Status',

  propTypes:
    process.env.NODE_ENV === 'production'
      ? {}
      : {
          message: PropTypes.string,
        },

  componentDidMount: function () {
    var _this = this;

    // This is needed as `componentDidUpdate`
    // does not fire on the initial render.
    _this.setTextContent(_this.props.message);
  },

  componentDidUpdate: function () {
    var _this = this;

    _this.setTextContent(_this.props.message);
  },

  render: function () {
    return (
      <span
        role="status"
        aria-live="polite"
        ref={(node) => (this.node = node)}
        style={{
          left: '-9999px',
          position: 'absolute',
        }}
      />
    );
  },

  // We cannot set `textContent` directly in `render`,
  // because React adds/deletes text nodes when rendering,
  // which confuses screen readers and doesn't cause them to read changes.
  setTextContent: function (textContent) {
    // We could set `innerHTML`, but it's better to avoid it.
    this.node.textContent = textContent || '';
  },
});
