import React, {
  useState, useRef, useContext, useCallback,
} from 'react';
import {
  Modal, DropdownButton, MenuItem, Button,
} from 'react-bootstrap';
import shortid from 'shortid';
import _ from 'lodash';

import questionTemplates from '@/questionTemplates';
import CurieSelectorContainer from '../../../components/shared/curies/CurieSelectorContainer';

function extractDetails(questionTemplate) {
  const newTypes = [];
  const newLabels = [];
  const newCuries = [];
  questionTemplate.query_graph.nodes.forEach((node) => {
    if (node.curie) {
      // we're going to grab the number of the identifier from the curie and add that node's type to the list of types in its correct spot.
      if (Array.isArray(node.curie)) {
        node.curie.forEach((curie) => {
          // find the indentifier's number
          const i = curie.match(/\d/);
          // minus one because index starts at 0
          newTypes[i - 1] = node.type;
        });
      } else {
        const i = node.curie.match(/\d/);
        newTypes[i - 1] = node.type;
      }
      newLabels.push('');
      newCuries.push('');
    }
  });
  return { newTypes, newLabels, newCuries };
}

function displayQuestion(questionName) {
  if (questionName.length > 0) {
    // here we just add a space in between each word.
    for (let i = 0; i < questionName.length; i += 2) {
      questionName.splice(i, 0, ' ');
    }
  }
  return questionName;
}

export default function QuestionTemplateModal(props) {
  const {
    selectQuestion, showModal, close,
  } = props;
  const [questionTemplate, setQuestionTemplate] = useState({});
  const [questionName, updateQuestionName] = useState([]);
  const [disableSubmit, setDisableSubmit] = useState(true);
  const [nameList, updateNameList] = useState([]);
  const [types, setTypes] = useState([]);
  const [labels, setLabels] = useState([]);
  const [curies, setCuries] = useState([]);

  // Using a ref here ensures that we have an up-to-date nameList value
  // in the setFocus method
  const nameListRef = useRef(null);
  nameListRef.current = nameList;

  function setFocus(i) {
    if (nameListRef.current.length === 0) return;

    nameListRef.current[i].ref.current.focus();
  }

  function replaceName(qName, newTypes) {
    const newNameList = [];
    let question = qName;
    question = question.split(/\s|\?/g);
    let num = 1;
    for (let i = 0; i < question.length; i += 1) {
      const nameRegex = `$name${num}$`;
      const idRegex = `($identifier${num}$)`;
      if (question[i] === nameRegex) {
        const refNum = num - 1;
        question[i] = (
          <button
            type="button"
            style={{
              textDecoration: 'underline', color: 'grey', border: 'none', backgroundColor: 'white',
            }}
            onClick={() => setFocus(refNum)}
            key={shortid.generate()}
          >
            {newTypes[refNum]}
          </button>
        );
        newNameList.push({
          nameIndex: i, name: '', id: '', ider: refNum, ref: { current: null },
        });
        for (let j = i; j < question.length; j += 1) {
          if (question[j] === idRegex) {
            question.splice(j, 1);
          }
        }
        num += 1;
      }
    }
    updateNameList(newNameList);
    return question;
  }

  function selectNewQuestionTemplate(event) {
    const newQuestionTemplate = _.cloneDeep(event);
    let newQuestionName = newQuestionTemplate.natural_question;
    const { newTypes, newLabels, newCuries } = extractDetails(newQuestionTemplate);
    newQuestionName = replaceName(newQuestionName, newTypes);
    setQuestionTemplate(newQuestionTemplate);
    updateQuestionName(newQuestionName);
    setTypes(newTypes);
    setCuries(newCuries);
    setLabels(newLabels);
  }

  /*
  function updateQuestionTemplate() {
    questionTemplate.natural_question = questionName.join(' ');
    let num = 0;
    questionTemplate.query_graph.nodes.forEach((node, index) => {
      if (node.curie) {
        if (Array.isArray(node.curie)) {
          node.curie.forEach((curie, i) => {
            // TODO: num only works if there's only one curie in the array. So far, that's the only case.
            questionTemplate.query_graph.nodes[index].curie[i] = nameList[num].id;
            questionTemplate.query_graph.nodes[index].name = nameList[num].name;
            num += 1;
          });
        } else {
          questionTemplate.query_graph.nodes[index].curie = nameList[0].id;
          questionTemplate.query_graph.nodes[index].name = nameList[0].name;
        }
      }
    });
    setQuestionTemplate({ ...questionTemplate });
    setDisableSubmit(false);
  }
  */

  function handleIdentifierChange(index, value) {
    const { curie, name: label } = value;

    // Values that we update during this function
    const newQuestionName = [...questionName];
    const newNameList = [...nameList];
    const newLabels = [...labels];
    const newCuries = [...curies];

    nameList.forEach((name, i) => {
      if (name.ider === index && label && curie) {
        newQuestionName[name.nameIndex] = `${label} (${curie})`;
        newNameList[i].name = label;
        newNameList[i].id = curie;
        newLabels[index] = label;
        newCuries[index] = curie;
        // check to see if all entries in nameList have a label and curie and update question template if they do.
        const update = newNameList.every((nameObj) => nameObj.name && nameObj.id);
        if (update) {
          updateQuestionTemplate();
        }
      } else if (name.ider === index && !label && !curie) {
        // we delete whatever was there before. Disable the submit button.
        newQuestionName[name.nameIndex] = (
          <button
            type="button"
            style={{
              textDecoration: 'underline', color: 'grey', border: 'none', backgroundColor: 'white',
            }}
            onClick={() => setFocus(i)}
            key={shortid.generate()}
          >
            {types[name.ider]}
          </button>
        );
        newLabels[name.ider] = '';
        newCuries[name.ider] = '';
        setDisableSubmit(true);
      }

      updateQuestionName(newQuestionName);
      updateNameList(newNameList);
      setLabels(newLabels);
      setCuries(newCuries);
    });
  }

  function submitTemplate() {
    selectQuestion(questionTemplate);
    setQuestionTemplate({});
    updateQuestionName([]);
    setDisableSubmit(true);
    updateNameList([]);
    setTypes([]);
    setLabels([]);
    setCuries([]);
  }

  return (
    <Modal
      style={{ marginTop: '5%' }}
      show={showModal}
      backdrop
      onHide={close}
    >
      <Modal.Header closeButton>
        <Modal.Title>Question Templates</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ minHeight: 200 }}>
        <div className="questionTemplateDropdown" id={questionName.length > 0 ? '' : 'centeredQuestionTemplateMenu'}>
          <DropdownButton
            bsStyle="default"
            title={questionName.length > 0 ? 'Change templates' : 'Select a question template'}
            key={1}
            id="questionTemplateDropdown"
          >
            {questionTemplates.map((question) => (
              <MenuItem
                key={shortid.generate()}
                eventKey={question}
                onSelect={selectNewQuestionTemplate}
              >
                {question.natural_question}
              </MenuItem>
            ))}
          </DropdownButton>
        </div>
        {questionName.length > 0 && (
          <div>
            <h4
              style={{
                display: 'block', width: '100%', margin: '20px 0px', height: '45px', fontSize: '20px', textAlign: 'center', cursor: 'default',
              }}
            >
              {displayQuestion(_.cloneDeep(questionName))}
            </h4>
            <p>Choose curies below to fill out the template.</p>
          </div>
        )}
        {nameList.map((name, i) => (
          <CurieSelectorContainer
            key={['curieSelector', i].join('_')}
            ref={(type) => { curieSelector.current[`curie${i}`] = type; }}
            concepts={concepts}
            onChangeHook={(ty, te, cu) => handleCurieChange(i, ty, te, cu)}
            initialInputs={{ curie: curies[i], term: labels[i], type: types[i] }}
            disableType
            search={() => {}}
          />
        ))}
      </Modal.Body>
      <Modal.Footer>
        <Button id="questionTempButton" onClick={submitTemplate} disabled={disableSubmit}>Load Question</Button>
      </Modal.Footer>
    </Modal>
  );
}