import React, { useEffect, useContext, useMemo } from 'react';
import { useRouteMatch, useHistory } from 'react-router-dom';
import { get as idbGet, del as idbDelete, set as idbSet } from 'idb-keyval';

import API from '~/API';
import trapiUtils from '~/utils/trapi';
import usePageStatus from '~/stores/usePageStatus';
import UserContext from '~/context/user';
import AlertContext from '~/context/alert';
import queryGraphUtils from '~/utils/queryGraph';

import useAnswerStore from './useAnswerStore';
import useDisplayState from './useDisplayState';

import LeftDrawer from './leftDrawer/LeftDrawer';
import KgBubble from './kgBubble/KgBubble';
import KgFull from './fullKg/KgFull';
import QueryGraph from './queryGraph/QueryGraph';
import ResultsTable from './resultsTable/ResultsTable';

import './answer.css';

/**
 * Main Answer Page component
 *
 * Displays
 * - query graph
 * - knowledge graph bubble chart
 * - full knowledge graph
 * - results table
 */
export default function Answer() {
  const answerStore = useAnswerStore();
  const pageStatus = usePageStatus(false);
  const displayAlert = useContext(AlertContext);
  const user = useContext(UserContext);
  const history = useHistory();
  const { displayState, updateDisplayState } = useDisplayState();

  /**
   * If we are rendering an answer, get answer_id with useRouteMatch
   */
  const match = useRouteMatch('/answer/:answer_id');

  /**
   * Get answer id from url
   */
  const answer_id = useMemo(() => match && match.params.answer_id, [match]);

  /**
   * Validate a TRAPI message and either display any errors or initialize the answer store
   * @param {object|String} answerResponse - Either an object with error message or stringified message object
   */
  function validateAndInitializeMessage(answerResponse) {
    if (answerResponse.status === 'error') {
      pageStatus.setFailure(answerResponse.message);
      return;
    }

    let answerResponseJSON;
    try {
      answerResponseJSON = JSON.parse(answerResponse);
    } catch (err) {
      pageStatus.setFailure('Invalid answer JSON');
      return;
    }

    if (answerResponseJSON.status === 'error') {
      pageStatus.setFailure(
        `Error during answer processing: ${answerResponseJSON.message}`,
      );
      return;
    }

    const validationErrors = trapiUtils.validateMessage(answerResponseJSON);
    if (validationErrors.length) {
      pageStatus.setFailure(
        `Found errors while parsing message: ${validationErrors.join(', ')}`,
      );
      return;
    }

    try {
      answerResponseJSON.message.query_graph = queryGraphUtils.standardize(answerResponseJSON.message.query_graph);
      try {
        answerStore.initialize(answerResponseJSON.message);
        pageStatus.setSuccess();
      } catch (err) {
        displayAlert('error', `Failed to initialize message. Please submit an issue: ${err}`);
      }
    } catch (err) {
      displayAlert('error', 'Failed to parse this query graph. Please make sure it is TRAPI compliant.');
    }
  }

  /**
   * Get a message by id from Robokache
   */
  async function fetchAnswerData() {
    pageStatus.setLoading('Loading Message...');
    const answerResponse = await API.cache.getAnswerData(answer_id, user && user.id_token);

    validateAndInitializeMessage(answerResponse);
  }

  /**
   * Get or reset stored message whenever the answer id or user changes
   */
  useEffect(() => {
    if (answer_id) {
      idbDelete('quick_message');
      fetchAnswerData();
    } else {
      pageStatus.setLoading('Loading Message...');
      idbGet('quick_message')
        .then((val) => {
          if (val) {
            validateAndInitializeMessage(val);
          } else {
            // if quick_message === undefined
            answerStore.reset();
            // stop loading message
            pageStatus.setSuccess();
          }
        })
        .catch((err) => {
          answerStore.reset();
          displayAlert('error', `Failed to load answer. Please try refreshing the page. Error: ${err}`);
          // stop loading message
          pageStatus.setSuccess();
        });
    }
  }, [answer_id, user]);

  /**
   * Upload a TRAPI message for viewing
   * @param {*} event - html file input event
   */
  function onUpload(event) {
    const { files } = event.target;
    files.forEach((file) => {
      const fr = new window.FileReader();
      fr.onloadstart = () => pageStatus.setLoading('Loading Message...');
      fr.onload = (e) => {
        const fileContents = e.target.result;
        let msg = {};
        try {
          msg = JSON.parse(fileContents);
        } catch (err) {
          displayAlert('error', 'Failed to read this message. Are you sure this is valid JSON?');
        }
        const errors = trapiUtils.validateMessage(msg);
        if (!errors.length) {
          try {
            msg.message.query_graph = queryGraphUtils.standardize(msg.message.query_graph);
            try {
              idbSet('quick_message', JSON.stringify(msg));
              answerStore.initialize(msg.message);
              pageStatus.setSuccess();
              // user uploaded a new answer, reset the url
              if (match) {
                history.push('/answer');
              }
            } catch (err) {
              displayAlert('error', `Failed to initialize message. Please submit an issue: ${err}`);
            }
          } catch (err) {
            displayAlert('error', 'Failed to parse this query graph. Please make sure it is TRAPI compliant.');
          }
        } else {
          pageStatus.setFailure(errors.join(', '));
        }
      };
      fr.onerror = () => {
        displayAlert('error', 'Sorry but there was a problem uploading the file. The file may be invalid JSON.');
      };
      fr.readAsText(file);
    });
    // This clears out the input value so you can upload a second time
    event.target.value = '';
  }

  return (
    <>
      <LeftDrawer
        displayState={displayState}
        updateDisplayState={updateDisplayState}
        onUpload={onUpload}
        message={answerStore.message}
      />
      <div id="answerContentContainer">
        <pageStatus.Display />
        {pageStatus.displayPage && (
          <>
            {Object.keys(answerStore.message).length ? (
              <>
                {displayState.qg.show && (
                  <QueryGraph
                    query_graph={answerStore.message.query_graph}
                  />
                )}
                {displayState.kg.show && (
                  <KgBubble
                    nodes={answerStore.kgNodes}
                    numQgNodes={Object.keys(answerStore.message.query_graph.nodes).length}
                    numResults={answerStore.message.results.length}
                  />
                )}
                {displayState.kgFull.show && (
                  <KgFull
                    message={answerStore.message}
                  />
                )}
                {displayState.results.show && (
                  <ResultsTable
                    answerStore={answerStore}
                  />
                )}
              </>
            ) : (
              <div id="answerPageSplashMessage">
                <h2>Please upload an answer</h2>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
