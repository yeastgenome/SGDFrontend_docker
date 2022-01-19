const React = require('react');
const _ = require('underscore');
const d3 = require('d3');
const $ = require('jquery');
require('datatables');
require('foundation');
require('foundationDatatables');
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';

/*
	A react component that renders a table, then uses jQuery data tables to spice it up.
*/
const DataTable = createReactClass({
  displayName: 'DataTable',

  propTypes: {
    pluginOptions: PropTypes.any,
    tableId: PropTypes.any,
    usePlugin: PropTypes.any,
    data: PropTypes.any,
  },

  getDefaultProps: function () {
    return {
      data: null, // * { headers: [[]], rows: [[]]}
      pluginOptions: {},
      tableId: null,
      usePlugin: false, // if true, uses jQuery dataTable plugin after mounting
    };
  },

  // to not depend on _rootNodeID
  getInitialState: function () {
    var _fakeId =
      Math.round(Math.random() * 100).toString() +
      '.' +
      Math.round(Math.random() * 100).toString();
    return { fakeId: _fakeId };
  },

  render: function () {
    var headerRows = this._getHeaderRows();
    var bodyRows = this._getBodyRows();

    return (
      <div
        ref={(wrapper) => (this.wrapper = wrapper)}
        className="data-table table-scroll-container dataTables_wrapper"
      >
        <table
          id={this.props.tableId}
          ref={(table) => (this.table = table)}
          className="table table-striped table-bordered table-condensed"
        >
          <thead key="table-header">{headerRows}</thead>
          <tbody key="table-body">{bodyRows}</tbody>
        </table>
      </div>
    );
  },

  // if props.usePlugin, run dataTable plugin on table in DOM
  componentDidMount: function () {
    if (this.props.usePlugin) {
      var options = this._getTableOptions();
      this._setupTableHighlight();
      this._setupPlugins();
      var $table = $(this.table).dataTable(options);
      $(document).foundation();
      $(this.wrapper).find('input').attr('placeholder', 'Filter table');
      $table.fnSearchHighlighting();
    }
  },

  _setupPlugins: function () {
    $.fn.dataTableExt.oSort['range-desc'] = function (x, y) {
      x = x.split('-');
      y = y.split('-');

      var x0 = parseInt(x[0]);
      var y0 = parseInt(y[0]);

      return x0 > y0 ? -1 : x0 < y0 ? 1 : 0;
    };

    $.fn.dataTableExt.oSort['range-asc'] = function (x, y) {
      x = x.split('..');
      y = y.split('..');

      var x0 = parseInt(x[0]);
      var y0 = parseInt(y[0]);

      return x0 < y0 ? -1 : x0 > y0 ? 1 : 0;
    };
  },

  // legacy code to highlight search text within a table
  _setupTableHighlight: function () {
    $.fn.dataTableExt.oApi.fnSearchHighlighting = function (oSettings) {
      // Initialize regex cache
      oSettings.oPreviousSearch.oSearchCaches = {};

      oSettings.oApi._fnCallbackReg(
        oSettings,
        'aoRowCallback',
        function (nRow, aData, iDisplayIndex, iDisplayIndexFull) {
          // Initialize search string array
          var searchStrings = [];
          var oApi = this.oApi;
          var cache = oSettings.oPreviousSearch.oSearchCaches;
          // Global search string
          // If there is a global search string, add it to the search string array
          if (oSettings.oPreviousSearch.sSearch) {
            searchStrings.push(oSettings.oPreviousSearch.sSearch);
          }
          // Individual column search option object
          // If there are individual column search strings, add them to the search string array
          if (
            oSettings.aoPreSearchCols &&
            oSettings.aoPreSearchCols.length > 0
          ) {
            for (var i in oSettings.aoPreSearchCols) {
              if (oSettings.aoPreSearchCols[i].sSearch) {
                searchStrings.push(oSettings.aoPreSearchCols[i].sSearch);
              }
            }
          }
          // Create the regex built from one or more search string and cache as necessary
          if (searchStrings.length > 0) {
            var sSregex = searchStrings.join('|');
            if (!cache[sSregex]) {
              var regRules = '(',
                regRulesSplit = sSregex.split(' ');

              regRules += '(' + sSregex + ')';
              for (var i = 0; i < regRulesSplit.length; i++) {
                regRules += '|(' + regRulesSplit[i] + ')';
              }
              regRules += ')';

              // This regex will avoid in HTML matches
              cache[sSregex] = new RegExp(regRules + '(?!([^<]+)?>)', 'ig');
            }
            var regex = cache[sSregex];
          }
          // Loop through the rows/fields for matches
          $('td', nRow).each(function (i) {
            // Take into account that ColVis may be in use
            var j = oApi._fnVisibleToColumnIndex(oSettings, i);
            // Only try to highlight if the cell is not empty or null
            if (aData[j]) {
              // If there is a search string try to match
              if (
                typeof sSregex !== 'undefined' &&
                sSregex &&
                typeof aData[j] === 'string'
              ) {
                this.innerHTML = aData[j].replace(regex, function (matched) {
                  return "<span class='filterMatches'>" + matched + '</span>';
                });
              }
              // Otherwise reset to a clean string
              else {
                this.innerHTML = aData[j];
              }
            }
          });
          return nRow;
        },
        'row-highlight'
      );
      return this;
    };
  },

  _getBodyRows: function () {
    var bodyRows = this.props.data.rows.map((r, i) => {
      var evenKlass = i % 2 === 0 ? 'odd' : 'even';
      if (this.props.usePlugin) evenKlass = '';

      return (
        <tr key={'bodyRow' + i} className={evenKlass}>
          {r.map((d, _i) => {
            /* if data is obj with href and value, make a link, otherwise just plain text if just a string */
            if (d !== null) {
              return this._formatCell(d, i, _i);
            }
          })}
        </tr>
      );
    });

    return bodyRows;
  },

  _getHeaderRows: function () {
    var maxRowWidth = d3.max(this.props.data.headers, (r) => {
      return r.length;
    });

    var headerRows = _.map(this.props.data.headers, (r, i) => {
      var cells = _.map(r, (d, _i) => {
        // add a colspan if needed to make rows of equal col width
        var _colSpan = null;
        if (_i === r.length - 1 && r.length < maxRowWidth) {
          _colSpan = maxRowWidth - i;
        }

        {
          /* if data is obj with href and value, make a link, otherwise just plain text if just a string */
        }
        var textNode = d.href && d.value ? <a href={d.href}>{d.value}</a> : d;
        return (
          <td key={`cell${i}.${_i}`} colSpan={_colSpan}>
            {textNode}
          </td>
        );
      });
      return <tr key={'headerRow' + i}>{cells}</tr>;
    });

    return headerRows;
  },

  _formatCell: function (d, i, _i) {
    // allow raw HTML cell
    if (d.html) {
      return (
        <td
          key={`cell${i}.${_i}`}
          dangerouslySetInnerHTML={{ __html: d.html }}
        />
      );
    }
    // otherwise format plain text or whole link
    var textNode = d.href && d.value ? <a href={d.href}>{d.value}</a> : d;
    return <td key={`cell${i}.${_i}`}>{textNode}</td>;
  },

  _getTableOptions: function () {
    var options = this.props.pluginOptions;
    var id = this.state.fakeId;

    if ('oLanguage' in options) {
      if (!('sSearch' in options['oLanguage'])) {
        options['oLanguage'][
          'sSearch'
        ] = `<a href="#" data-dropdown="table-help${id
          .split('.')
          .join(
            ''
          )}" data-options="align:left"><i class="fa fa-question-circle"></i></a><div id="table-help${id
          .split('.')
          .join(
            ''
          )}" class="f-dropdown content medium" data-dropdown-content><p>Type a keyword (examples: “BAS1”, “zinc”) into this box to filter for those rows within the table that contain the keyword. Type in more than one keyword to find rows containing all keywords: for instance, “BAS1 37” returns rows that contain both "BAS1" and "37". To remove the filter, simply delete the text from the box. </p></div>`;
      } else {
        options['oLanguage'][
          'sSearch'
        ] = `<a href="#" data-dropdown="table-help${id
          .split('.')
          .join(
            ''
          )}" data-options="align:left"><i class="fa fa-question-circle"></i></a><div id="table-help${id
          .split('.')
          .join(
            ''
          )}" class="f-dropdown content medium" data-dropdown-content><p>' + options['oLanguage']['sSearch'] + '</p></div>`;
      }
    } else {
      options['oLanguage'] = {
        sSearch: `<a href="#" data-dropdown="table-help${id
          .split('.')
          .join(
            ''
          )}" data-options="align:left"><i class="fa fa-question-circle"></i></a><div id="table-help${id
          .split('.')
          .join(
            ''
          )}" class="f-dropdown content medium" data-dropdown-content><p>Type a keyword (examples: “BAS1”, “zinc”) into this box to filter for those rows within the table that contain the keyword. Type in more than one keyword to find rows containing all keywords: for instance, “BAS1 37” returns rows that contain both "BAS1" and "37". To remove the filter, simply delete the text from the box.</p></div>`,
      };
    }
    if ('sDom' in options) {
      // nothing? -Greg
    } else if (options['bPaginate'] || !('bPaginate' in options)) {
      options['sDom'] =
        '<"table-responsive" <"dt-tools-head"<"left"><"right" f>>rt<"dt-tools-foot" il <"right" p>>>';
    } else {
      //options['sDom'] = '<"clearfix" <"dt-tools-head"<"left"><"right" f>>t<"dt-tools-foot" i <"right">>>';
      options['sDom'] =
        '<"table-responsive" <"dt-tools-head"<"left"><"right" f>>t<"dt-tools-foot" <"right">>>';
    }
    options['bAutoWidth'] = false;
    return options;
  },
});

module.exports = DataTable;
