import React, { useState, useContext, useEffect } from 'react';

import Box from '@material-ui/core/Box';
import Alert from '@material-ui/lab/Alert';

import useMessageStore from '@/stores/useMessageStore';
import config from '@/config.json';
import parseMessage from '@/utils/parseMessage';

import Loading from '@/components/loading/Loading';

import API from '@/API';
import UserContext from '@/user';

import AnswersetView from './AnswersetView';

/*
 * Display an Answerset stored in Robokache
 * Wrapper around AnswersetView
 */
export default function StoredAnswersetView({ question_id, answer_id }) {
  const [loading, toggleLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const messageStore = useMessageStore();
  const user = useContext(UserContext);

  async function fetchQuestionAnswerData() {
    const questionPromise = API.getQuestionData(question_id, user && user.id_token);
    const answerPromise = API.getAnswerData(answer_id, user && user.id_token);

    const [questionResponse, answerResponse] =
       await Promise.all([questionPromise, answerPromise]);

    if (questionResponse.status === 'error') {
      setErrorMessage(questionResponse.message);
      toggleLoading(false);
      return;
    }
    if (answerResponse.status === 'error') {
      setErrorMessage(answerResponse.message);
      toggleLoading(false);
      return;
    }

    const message =
      { ...answerResponse, query_graph: questionResponse };

    try {
      const parsedMessage = parseMessage(message);
      messageStore.initializeMessage(parsedMessage);
      setErrorMessage('');
    } catch (err) {
      setErrorMessage('Unable to parse message. Please ensure that the question you submitted is a valid JSON object.');
    }

    toggleLoading(false);
  }

  useEffect(() => {
    fetchQuestionAnswerData();
  }, [question_id, answer_id, user]);

  return (
    <>
      { loading ? (
        <Loading />
      ) : (
        <>
          { errorMessage ? (
            <Box display="flex" justifyContent="center">
              <Alert variant="filled" severity="error">
                {errorMessage}
              </Alert>
            </Box>
          ) : (
            <AnswersetView
              user={user}
              concepts={config.concepts}
              messageStore={messageStore}
              omitHeader
            />
          )}
        </>
      )}
    </>
  );
}
