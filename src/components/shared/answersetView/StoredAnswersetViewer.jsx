import React, { useState, useContext, useEffect } from 'react';

import Box from '@material-ui/core/Box';
import Alert from '@material-ui/lab/Alert';

import Loading from '@/components/loading/Loading';
import useMessageStore from '@/stores/useMessageStore';
import config from '@/config.json';
import parseMessage from '@/utils/parseMessage';

import API from '@/API';
import UserContext from '@/context/user';
import usePageStatus from '@/utils/usePageStatus';

import AnswersetView from './AnswersetView';

/*
 * Display an Answerset stored in Robokache
 * Wrapper around AnswersetView
 */
export default function StoredAnswersetView({ question_id, answer_id }) {
  const pageStatus = usePageStatus();
  const messageStore = useMessageStore();
  const user = useContext(UserContext);

  async function fetchQuestionAnswerData() {
    const questionPromise = API.getQuestionData(question_id, user && user.id_token);
    const answerPromise = API.getAnswerData(answer_id, user && user.id_token);

    const [questionResponse, answerResponse] =
       await Promise.all([questionPromise, answerPromise]);

    if (questionResponse.status === 'error') {
      pageStatus.setFailure(questionResponse.message);
      return;
    }
    if (answerResponse.status === 'error') {
      pageStatus.setFailure(questionResponse.message);
      return;
    }

    const message =
      { ...answerResponse, query_graph: questionResponse };

    try {
      const parsedMessage = parseMessage(message);
      messageStore.initializeMessage(parsedMessage);
      pageStatus.setSuccess();
    } catch (err) {
      pageStatus.setFailure('Unable to parse message. Please ensure that the question you submitted is a valid JSON object.');
    }
  }

  useEffect(() => {
    fetchQuestionAnswerData();
  }, [question_id, answer_id, user]);

  return (
    <>
      <pageStatus.Display />

      { pageStatus.displayPage && (
        <>
          <AnswersetView
            user={user}
            concepts={config.concepts}
            messageStore={messageStore}
            omitHeader
          />
        </>
      )}
    </>
  );
}
