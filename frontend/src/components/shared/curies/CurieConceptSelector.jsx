import React, { useRef, useEffect } from 'react';

import {
  FormControl, Button, Badge, InputGroup,
} from 'react-bootstrap';
import shortid from 'shortid';

import { AutoSizer, List } from 'react-virtualized';

import getNodeTypeColorMap from '@/utils/colorUtils';
import curieUrls from '@/utils/curieUrls';

export default function CurieConceptSelector({
  concepts,
  curies,
  selection, handleSelect,
  searchTerm, updateSearchTerm,
  loading,
  rightButtonFunction, rightButtonContents,
  focus, clearFocus,
}) {
  // Reference to the input element used for setting focus
  const inputRef = useRef(null);
  useEffect(() => {
    if (!focus) return;

    // Set focus
    inputRef.current.focus();

    // After we have set focus, clear the variable so we can set it again
    if (clearFocus) clearFocus();
  }, [focus]);

  function rowRenderer({
    index,
    key,
    style,
  }) {
    const isConcept = index < concepts.length;
    let label = '';
    let entry = {};
    let degree;
    let links = '';
    let curie = '';
    let type = '';
    let colorStripes = [];
    let typeColor = '';
    if (isConcept) {
      label = concepts[index].label;
      entry = concepts[index];
      ({ type } = concepts[index]); // this is a string
      const typeColorMap = getNodeTypeColorMap();
      typeColor = typeColorMap(type);
    } else {
      const i = index - concepts.length;
      entry = curies[i];

      ({
        degree, type, label, curie,
      } = entry);
      const urls = curieUrls(curie);
      links = (
        <span>
          {urls.map((u) => (
            <a target="_blank" rel="noreferrer" href={u.url} alt={u.name} key={shortid.generate()} style={{ paddingRight: '3px' }}><img src={u.iconUrl} alt={u.name} height={16} width={16} /></a>
          ))}
        </span>
      );
      if (Array.isArray(type)) {
        type = type.filter((t) => t !== 'named_thing');
        const typeColorMap = getNodeTypeColorMap(type);
        colorStripes = type.map((t) => (
          <div
            title={t}
            style={{
              backgroundColor: typeColorMap(t),
              height: '100%',
              width: '5px',
            }}
            key={shortid.generate()}
          />
        ));
      }
    }

    const fullColor = typeof type === 'string';

    return (
      <div
        key={key}
        style={{ ...style, backgroundColor: typeColor }}
        className="nodePanelSelector"
        id={index === concepts.length - 1 && curies.length > 0 ? 'lastConcept' : ''}
      >
        {!fullColor && (
          <div className="colorStripesContainer">
            {colorStripes}
          </div>
        )}
        <div className="curieName">
          <div title={label}>{label}</div>
        </div>
        <div className="curieDetails">
          {curie}
          <Badge>{degree}</Badge>
          {links}
          <Button
            onClick={() => handleSelect(entry)}
          >
            Select
          </Button>
        </div>
      </div>
    );
  }

  const nRows = concepts.length + curies.length;
  const showOptions = searchTerm && !selection.type && !selection.curie.length;
  const showSelectedCurie = !showOptions && !!selection.curie.length;
  const isEmpty = nRows === 0;

  const rowHeight = 50;
  const height = Math.min(rowHeight * nRows, 225);

  return (
    <>
      <div id="nodeSelectorContainer">
        <InputGroup>
          <FormControl
            type="text"
            className="curieSelectorInput"
            placeholder="Start typing to search."
            value={searchTerm}
            inputRef={(ref) => { inputRef.current = ref; }}
            onChange={(e) => updateSearchTerm(e.target.value)}
          />
          {showSelectedCurie && (
            <InputGroup.Addon>
              {selection.curie[0]}
            </InputGroup.Addon>
          )}
          <InputGroup.Addon
            onClick={rightButtonFunction}
            style={{ background: '#fff', cursor: 'pointer' }}
          >
            {rightButtonContents}
          </InputGroup.Addon>
        </InputGroup>
        {showOptions && (
          <div style={{ margin: '0px 10px' }}>
            {!isEmpty && !loading ? (
              <AutoSizer disableHeight defaultWidth={100}>
                {({ width }) => (
                  <List
                    style={{
                      border: 'none',
                      marginTop: '0px',
                      outline: 'none',
                    }}
                    height={height}
                    overscanRowCount={10}
                    rowCount={nRows}
                    rowHeight={rowHeight}
                    rowRenderer={rowRenderer}
                    width={width}
                  />
                )}
              </AutoSizer>
            ) : (
              <div
                className="nodePanelSelector"
                style={{ padding: '10px', color: '#ccc' }}
              >
                <span>
                  {loading ? 'Loading...' : 'No results found.'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
