const router = require('express').Router();
const axios = require('axios');

const robokache = require('./robokache');
const { handleAxiosError } = require('./utils');

// const messenger = process.env.MESSENGER_URL ||
//                    'http://robokop.renci.org:4868/answer';
// const strider = process.env.STRIDER_URL ||
//                     'http://robokop.renci.org:5781';
const robokop = process.env.ROBOKOP_URL || 'http://robokop.renci.org:7092';

router.route('/answer')
  .post(async (req, res) => {
    const { questionId } = req.query;
    try {
      let response = await robokache.getQuestionData(questionId, req.headers.authorization);
      if (response.status === 'error') {
        return res.send(response);
      }
      const message = response;
      const config = {
        method: 'POST',
        url: `${robokop}/query`,
        data: message,
        // don't parse the response
        transformResponse: [(data) => data],
      };

      let answer;
      try {
        // Go ask Messenger for an answer
        response = await axios(config);

        // Validate json
        try {
          answer = JSON.parse(response.data);
        } catch (error) {
          answer = {
            status: 'error',
            message: 'Recieved unparseable JSON response from Messenger',
          };
        }
      } catch (err) {
        // Save error in robokache
        answer = handleAxiosError(err);
      }

      // Create a new answer in Robokache
      response = await robokache.createAnswer({ parent: questionId, visibility: 1 }, req.headers.authorization);
      if (response.status === 'error') {
        return res.send(response);
      }
      const answerId = response.id;
      response = await robokache.setAnswerData(answerId, answer, req.headers.authorization);
      if (response.status === 'error') {
        return res.send(response);
      }
      return res.status(200).send({ id: answerId });
    } catch (error) {
      // TODO: can we handle this better?
      return res.status(500).send(handleAxiosError(error));
    }
  });

module.exports = router;
