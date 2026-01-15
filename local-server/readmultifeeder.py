import os
 
from cimgraph.databases import XMLFile
from cimgraph.models import FeederModel
 
os.environ[ 'CIMG_VALIDATION_LOG_LEVEL' ] = 'WARNING'
os.environ[ 'CIMG_CIM_PROFILE' ] = 'cimgraph.data_profile.cim18gmdm.canonical'

namespaces = {
   'cim': 'http://cim.ucaiug.io/CIM101/draft#',
   'gmdm': 'http://epri.com/gmdm/2025#',
   'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
}

def read_feeder_cim(filepath):
   file = XMLFile(filename=filepath, namespaces=namespaces)
   return FeederModel(container=None, connection=file)