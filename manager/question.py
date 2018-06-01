'''
Question definition
'''

# standard modules
import os
import sys
import json
import warnings

# 3rd-party modules
from sqlalchemy.types import JSON
from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship, backref
from sqlalchemy.ext.associationproxy import association_proxy
from sqlalchemy.ext.declarative import declarative_base

# our modules
from manager.user import User
from manager.setup import db, association_table
from manager.logging_config import logger

class Question(db.Model):
    '''
    Represents a question such as "What genetic condition provides protection against disease X?"

    methods:
    * answer() - a struct containing the ranked answer paths
    * cypher() - the appropriate Cypher query for the Knowledge Graph
    '''

    __tablename__ = 'question'
    id = Column(String, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id'))
    natural_question = Column(String)
    notes = Column(String)
    name = Column(String)
    nodes = Column(JSON)
    edges = Column(JSON)

    answersets = relationship(
        "Answerset",
        secondary=association_table,
        back_populates="questions")
    user = relationship(
        User,
        backref=backref('questions',
                        uselist=True,
                        cascade='delete,all'))

    def __init__(self, *args, **kwargs):
        '''
        keyword arguments: id, user, notes, natural_question, nodes, edges
        q = Question(kw0=value, ...)
        q = Question(struct, ...)
        '''

        # initialize all properties
        self.user_id = None
        self.id = None
        self.notes = None
        self.name = None
        self.natural_question = None
        self.name = None
        self.nodes = [] # list of nodes
        self.edges = [] # list of edges

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

        # replace input node names with identifiers
        for n in self.nodes:
            if 'nodeSpecType' in n:
                if n['nodeSpecType'] == 'Named Node':
                    identifiers = [n['meta']['identifier']]
                    n['identifiers'] = identifiers
                else:
                    n['identifiers'] = []

        db.session.add(self)
        db.session.commit()

    @staticmethod
    def dictionary_to_graph(dictionary):
        '''
        Convert struct from blackboards database to nodes and edges structs
        '''

        if 'nodes' in dictionary and 'edges' in dictionary:
            return dictionary['nodes'], dictionary['edges']

        query = dictionary

        # convert to list of nodes (with conditions) and edges with lengths
        nodes = [dict(n, **{"id":i}) for i, n in enumerate(query)\
            if not n['nodeSpecType'] == 'Unspecified Nodes']
        edges = [dict(source_id=i-1, target_id=i, length=[query[i-1]['meta']['numNodesMin']+1, query[i-1]['meta']['numNodesMax']+1])\
            if i > 0 and query[i-1]['nodeSpecType'] == 'Unspecified Nodes'\
            else dict(source_id=i-1, target_id=i, length=[1])\
            for i, n in enumerate(query)\
            if i > 0 and not n['nodeSpecType'] == 'Unspecified Nodes']

        return nodes, edges

    def __str__(self):
        return "<ROBOKOP Question id={}>".format(self.id)

    def toJSON(self):
        keys = [str(column).split('.')[-1] for column in self.__table__.columns]
        struct = {key:getattr(self, key) for key in keys}
        return struct

def list_questions():
    return db.session.query(Question).all()

def list_questions_by_username(username, invert=False):
    if invert:
        return db.session.query(Question).join(Question.user).filter(User.username != username).all()
    else:
        return db.session.query(Question).join(Question.user).filter(User.username == username).all()

def list_questions_by_user_id(user_id, invert=False):
    if invert:
        return db.session.query(Question).filter(Question.user_id != user_id).all()
    else:
        return db.session.query(Question).filter(Question.user_id == user_id).all()

def get_question_by_id(id):
    question = db.session.query(Question).filter(Question.id == id).first()
    if not question:
        raise KeyError("No such question.")
    return question
