import React, {
  useState, useReducer, useEffect, useMemo,
} from 'react';
import Paper from '@material-ui/core/Paper';
import IconButton from '@material-ui/core/IconButton';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Collapse from '@material-ui/core/Collapse';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';
import shortid from 'shortid';

function expansionReducer(state, action) {
  switch (action.type) {
    case 'toggle':
      state[action.key] = !state[action.key];
      break;
    case 'clear':
      return {};
    default:
      break;
  }
  return { ...state };
}

/**
 * Show expandable supporting publications for all edges of a selected result
 * @param {object} metaData - selected result edge metadata
 * @param {object} result - full node and edge result json from knowledge graph
 */
export default function SupportingPublications({ metaData, result }) {
  const [expanded, updateExpanded] = useReducer(expansionReducer, {});
  const [showJSON, toggleJSONVisibility] = useState(false);

  useEffect(() => {
    // Whenever the user selects a new row, close all expanded rows
    updateExpanded({ type: 'clear' });
  }, [metaData]);

  const hasSupportPublications = useMemo(() => !!Object.values(metaData).find((edge) => edge.length), [metaData]);

  return (
    <Paper
      id="resultMetaData"
      elevation={3}
    >
      <div>
        <h4>Supporting Publications</h4>
        {hasSupportPublications ? (
          <List>
            {Object.entries(metaData).map(([edgeDescription, publications]) => (
              <React.Fragment key={shortid.generate()}>
                {publications.length > 0 && (
                  <>
                    <ListItem
                      button
                      onClick={() => updateExpanded({ type: 'toggle', key: edgeDescription })}
                    >
                      <ListItemText primary={edgeDescription} />
                      {expanded[edgeDescription] ? <ExpandLess /> : <ExpandMore />}
                    </ListItem>
                    <Collapse in={expanded[edgeDescription]} timeout="auto" unmountOnExit>
                      <List component="div">
                        {publications.map((publication) => (
                          <ListItem
                            button
                            component="a"
                            key={shortid.generate()}
                            href={`https://www.ncbi.nlm.nih.gov/pubmed/${publication.split(':')[1]}/`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ListItemText
                              primary={`https://www.ncbi.nlm.nih.gov/pubmed/${publication.split(':')[1]}/`}
                              inset
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Collapse>
                  </>
                )}
              </React.Fragment>
            ))}
          </List>
        ) : (
          <List>
            <ListItem>
              <ListItemText primary="No Supporting Publications Found" />
            </ListItem>
          </List>
        )}
      </div>
      <div>
        <h4>
          Result JSON
          &nbsp;
          <IconButton
            onClick={() => toggleJSONVisibility(!showJSON)}
          >
            {!showJSON ? (
              <ExpandMore />
            ) : (
              <ExpandLess />
            )}
          </IconButton>
        </h4>
        {showJSON && (
          <pre id="resultJSONContainer">{JSON.stringify(result, null, 2)}</pre>
        )}
      </div>
    </Paper>
  );
}
