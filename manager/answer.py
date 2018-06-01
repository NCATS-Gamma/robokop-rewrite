'''
Answer class
'''

import time
import json
import datetime
import logging
import warnings

from sqlalchemy.types import ARRAY as Array
from sqlalchemy import Column, DateTime, String, Integer, Float, ForeignKey
from sqlalchemy.types import JSON
from sqlalchemy.orm import relationship, backref
from sqlalchemy import event
from sqlalchemy import DDL

from manager.setup import db, association_table

logger = logging.getLogger(__name__)

class Answerset(db.Model):
    '''
    An "answer" to a Question.
    Contains a ranked list of walks through the Knowledge Graph.
    '''

    __tablename__ = 'answerset'
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    filename = Column(String)
    creator = Column(String)
    
    questions = relationship(
        "Question",
        secondary=association_table,
        back_populates="answersets")

    def __init__(self, *args, **kwargs):
        self.answers = []
        self.misc_info = None
        self.filename = None
        self.creator = 'ROBOKOP'
        self.__idx = 0

        # apply json properties to existing attributes
        attributes = self.__dict__.keys()
        if args:
            struct = args[0]
            for key in struct:
                if key in attributes:
                    if key=='answers':
                        struct[key] = [Answer(a) for a in struct[key]]

                    setattr(self, key, struct[key])
                else:
                    warnings.warn("JSON field {} ignored.".format(key))

        # override any json properties with the named ones
        for key in kwargs:
            if key in attributes:
                setattr(self, key, kwargs[key])
            else:
                warnings.warn("Keyword argument {} ignored.".format(key))

        db.session.add(self)
        db.session.commit()

    def __str__(self):
        return "<ROBOKOP Answer Set id={}>".format(self.id)

    def toJSON(self):
        keys = [str(column).split('.')[-1] for column in self.__table__.columns]
        struct = {key:getattr(self, key) for key in keys}
        if 'timestamp' in struct:
            struct['timestamp'] = struct['timestamp'].isoformat()
        return struct
    
    def toStandard(self, data=True):
        '''
        context
        datetime
        id
        message
        original_question_text
        response_code
        result_list
        '''
        json = self.toJSON()
        natural_question = json['misc_info']['natural_question'] if 'mics_info' in json else None
        output = {
            'context': 'context',
            'datetime': json['timestamp'],
            'id': json['id'],
            'message': f"{len(self.answers)} potential answers found.",
            'original_question_text': natural_question,\
            'response_code': 'OK' if self.answers else 'EMPTY',
            'result_list': [a.toStandard() for a in self.answers] if data else None
        }
        return output

    def add(self, answer):
        '''
        Add an Answer to the AnswerSet
        '''

        if not isinstance(answer, Answer):
            raise ValueError("Only Answers may be added to AnswerSets.")

        self.answers += [answer]
        db.session.commit()
        return self

    def __iadd__(self, answer):
        return self.add(answer)

    def __getitem__(self, key):
        return self.answers[key]
        
    def __iter__(self):
        return self

    def __next__(self):
        if self.__idx >= len(self.answers):
            raise StopIteration
        else:
            self.__idx += 1
            return self.answers[self.__idx-1]

    def len(self):
        return len(self.answers)

event.listen(
    Answerset.__table__,
    "after_create",
    DDL("ALTER SEQUENCE answerset_id_seq RESTART WITH 1453;")
)

class Answer(db.Model):
    '''
    Represents a single answer walk
    '''

    __tablename__ = 'answer'
    id = Column(Integer, primary_key=True)
    # TODO: think about how scoring data should be handled
    # score = Column(Float)
    score = Column(JSON)
    natural_answer = Column(String)
    answerset_id = Column(Integer, ForeignKey('answerset.id'))
    nodes = Column(JSON)
    edges = Column(JSON)
    # TODO: move node/edge details to AnswerSet
    # nodes = Column(Array(String))
    # edges = Column(Array(String))

    # Use cascade='delete,all' to propagate the deletion of an AnswerSet onto its Answers
    answerset = relationship(
        Answerset,
        backref=backref('answers',
                        uselist=True,
                        cascade='delete,all'))

    def __init__(self, *args, **kwargs):
        # initialize all attributes
        self.id = None # int
        self.answerset = None # AnswerSet
        self.natural_answer = None # str
        self.nodes = [] # list of str
        self.edges = [] # list of str
        self.score = None # float

        # apply json properties to existing attributes
        attributes = self.__dict__.keys()
        if args:
            struct = args[0]
            for key in struct:
                if key in attributes:
                    setattr(self, key, struct[key])
                else:
                    warnings.warn("JSON field {} ignored.".format(key))

        # override any json properties with the named ones
        for key in kwargs:
            if key in attributes:
                setattr(self, key, kwargs[key])
            else:
                warnings.warn("Keyword argument {} ignored.".format(key))

    def __str__(self):
        return "<ROBOKOP Answer id={}>".format(self.id)

    def toJSON(self):
        keys = [str(column).split('.')[-1] for column in self.__table__.columns]
        struct = {key:getattr(self, key) for key in keys}
        return struct

    def toStandard(self):
        '''
        confidence
        id
        result_graph:
            edge_list:
                confidence
                origin_list
                source_id
                target_id
                type
            node_list:
                accession
                description
                id
                name
                node_attributes
                symbol
                type
        result_type
        text
        '''
        json = self.toJSON()
        output = {
            'confidence': json['score']['rank_score'],
            'id': json['id'],
            'result_graph': {
                'node_list': [standardize_node(n) for n in json['nodes']],
                'edge_list': [standardize_edge(e) for e in json['edges']]
            },
            'result_type': 'individual query answer',
            'text': generate_summary(json['nodes'], json['edges'])
        }
        return output

def generate_summary(nodes, edges):
    # assume that the first node is at one end
    summary = nodes[0]['name']
    latest_node_id = nodes[0]['id']
    node_ids = [n['id'] for n in nodes]
    edges = [e for e in edges if not e['predicate'] == 'literature_co-occurrence']
    edge_starts = [e['source_id'] for e in edges]
    edge_ends = [e['target_id'] for e in edges]
    edge_predicates = [e['predicate'] for e in edges]
    while True:
        if latest_node_id in edge_starts:
            idx = edge_starts.index(latest_node_id)
            edge_starts.pop(idx)
            latest_node_id = edge_ends.pop(idx)
            latest_node = nodes[node_ids.index(latest_node_id)]
            summary += f" -{edge_predicates.pop(idx)}-> {latest_node['name']}"
        elif latest_node_id in edge_ends:
            idx = edge_ends.index(latest_node_id)
            edge_ends.pop(idx)
            latest_node_id = edge_starts.pop(idx)
            latest_node = nodes[node_ids.index(latest_node_id)]
            summary += f" <-{edge_predicates.pop(idx)}- {latest_node['name']}"
        else:
            break
    return summary

def standardize_edge(edge):
    '''
    confidence
    provided_by
    source_id
    target_id
    type
    '''
    output = {
        'confidence': edge['weight'],
        'provided_by': edge['edge_source'],
        'source_id': edge['source_id'],
        'target_id': edge['target_id'],
        'type': edge['predicate'],
        'publications': edge['publications']
    }
    return output

def standardize_node(node):
    '''
    description
    id
    name
    node_attributes
    symbol
    type
    '''
    output = {
        'description': node['name'],
        'id': node['id'],
        'name': node['name'],
        'type': node['node_type']
    }
    return output

def list_answersets():
    return db.session.query(Answerset).all()

def get_answer_by_id(id):
    answer = db.session.query(Answer).filter(Answer.id == id).first()
    if not answer:
        raise KeyError("No such answer.")
    return answer

def list_answers_by_answerset(answerset):
    answers = db.session.query(Answer)\
        .filter(Answer.answerset == answerset)\
        .all()
    return answers

def get_answerset_by_id(id):
    answerset = db.session.query(Answerset).filter(Answerset.id == id).first()
    if not answerset:
        raise KeyError("No such answerset.")
    return answerset