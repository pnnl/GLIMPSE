from typing import Any, Hashable, Dict, List, Optional, Callable
import os
import json
import logging
import tempfile
import re
from uuid import UUID
from dataclasses import fields, is_dataclass, asdict

from flask import Flask, request as req, jsonify, send_file
from flask_cors import CORS
from flask_socketio import SocketIO
import networkx as nx
import glm

from cimbuilder.object_builder import new_energy_consumer
from cimbuilder.object_builder import new_synchronous_generator
from cimbuilder.object_builder import new_two_terminal_object

# CIM-graph imports
from cimgraph.models import FeederModel, BusBranchModel, NodeBreakerModel
import cimgraph.utils as cim_utils
from cimgraph.databases import XMLFile
import cimgraph.data_profile.cimhub_2023 as cim
from cimbuilder.object_builder import new_energy_consumer, new_synchronous_generator, new_two_terminal_object

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
_log = logging.getLogger(__name__)

# Environment setup
os.environ["CIMG_CIM_PROFILE"] = "cimhub_2023"
os.environ["CIMG_IEC61970_301"] = "8"

# ================================================================================================
# GLOBAL VARIABLES AND CONSTANTS
# ================================================================================================

# NetworkX graph for topology analysis
NX_GRAPH = nx.MultiGraph()

# Current CIM network model - this holds the main graph data
CIM_NETWORK = None

# Current database connection (can be XML file, Neo4j, etc.)
CURRENT_CONNECTION = None

# CIM profile being used (default: cimhub_2023)
CIM_PROFILE = cim

# Available container objects (feeders, substations, etc.) from database
AVAILABLE_CONTAINERS = []

# Data loading status tracking
DATA_CATEGORIES_LOADED = {
    'lines': False,
    'transformers': False,
    'loads': False,
    'inverters': False,
    'switches': False,
    'buses': False,
    'measurements': False,
    'limits': False,
    'locations': False
}

# CIM object type classifications for easier filtering
LOAD_TYPES = ["EnergyConsumer", "ConformLoad", "NonConformLoad"]
GEN_TYPES = ["RotatingMachine", "SynchronousMachine", "AsynchronousMachine", "EnergySource"]
CAP_TYPES = ["ShuntCompensator", "LinearShuntCompensator"]
INV_TYPES = ["PowerElectronicsConnection"]
TRANS_TYPES = ["PowerTransformer"]
SWITCH_TYPES = ["LoadBreakSwitch"]

# ================================================================================================
# UTILITY FUNCTIONS
# ================================================================================================

def glm_to_dict(file_paths: list) -> dict:
    """
    Convert GridLAB-D model files (.glm) to dictionary format

    Args:
        file_paths: List of paths to .glm files

    Returns:
        Dictionary with filename as key and GLM content as value
    """
    glm_dicts = {}
    for glm_path in file_paths:
        glm_dicts[os.path.basename(glm_path).split(".")[0] + ".json"] = glm.load(glm_path)
    return glm_dicts

def dict2json(glm_dict: dict) -> str:
    """
    Convert dictionary to formatted JSON string

    Args:
        glm_dict: Dictionary to convert

    Returns:
        Pretty-formatted JSON string
    """
    return json.dumps(glm_dict, indent=3)

def object_to_detail(obj) -> Dict[str, Any]:
    """
    Convert a CIM object to detailed dictionary representation

    Args:
        obj: CIM object instance

    Returns:
        Dictionary with object details including attributes and associations
    """
    if not obj:
        return {}

    detail = {
        'identifier': str(getattr(obj, 'identifier', getattr(obj, 'mRID', 'unknown'))),
        'class_name': obj.__class__.__name__,
        'display_name': getattr(obj, 'name', str(getattr(obj, 'identifier', 'unnamed'))),
        'attributes': {},
        'associations': {}
    }

    # Get all dataclass fields if this is a dataclass
    if is_dataclass(obj):
        for field in fields(obj):
            value = getattr(obj, field.name, None)
            if value is not None:
                if field.metadata.get('type') == 'Association':
                    # This is a relationship to another object
                    if hasattr(value, 'identifier'):
                        detail['associations'][field.name] = str(value.identifier)
                    else:
                        detail['associations'][field.name] = str(value)
                else:
                    # This is a simple attribute
                    detail['attributes'][field.name] = str(value)

    return detail

def object_to_summary(obj) -> Dict[str, Any]:
    """
    Convert a CIM object to summary representation (for lists and search results)

    Args:
        obj: CIM object instance

    Returns:
        Dictionary with basic object information
    """
    summary = {
        'identifier': str(getattr(obj, 'identifier', getattr(obj, 'mRID', 'unknown'))),
        'class_name': obj.__class__.__name__,
        'display_name': getattr(obj, 'name', str(getattr(obj, 'identifier', 'unnamed'))),
        'key_attributes': {}
    }

    # Add some key attributes for preview
    key_attrs = ['name', 'description', 'mRID', 'p', 'q', 'voltage', 'length']
    for attr in key_attrs:
        if hasattr(obj, attr):
            value = getattr(obj, attr)
            if value is not None:
                summary['key_attributes'][attr] = str(value)

    return summary

def parse_search_condition(condition: str) -> Callable:
    """
    Parse a search condition string into a callable predicate function

    Args:
        condition: String like ">10", "contains:text", "regex:pattern"

    Returns:
        Function that can be called with a value to test the condition
    """
    condition = condition.strip()

    # Numeric comparisons
    if condition.startswith('>'):
        threshold = float(condition[1:])
        return lambda x: float(x) > threshold
    elif condition.startswith('<'):
        threshold = float(condition[1:])
        return lambda x: float(x) < threshold
    elif condition.startswith('>='):
        threshold = float(condition[2:])
        return lambda x: float(x) >= threshold
    elif condition.startswith('<='):
        threshold = float(condition[2:])
        return lambda x: float(x) <= threshold

    # String operations
    elif condition.startswith('contains:'):
        search_str = condition[9:].strip()
        return lambda x: search_str.lower() in str(x).lower()
    elif condition.startswith('regex:'):
        pattern = condition[6:].strip()
        regex = re.compile(pattern, re.IGNORECASE)
        return lambda x: regex.search(str(x)) is not None
    elif condition.startswith('startswith:'):
        search_str = condition[11:].strip()
        return lambda x: str(x).lower().startswith(search_str.lower())
    elif condition.startswith('endswith:'):
        search_str = condition[9:].strip()
        return lambda x: str(x).lower().endswith(search_str.lower())

    # Default: exact string match
    return lambda x: str(x) == condition

# ================================================================================================
# FLASK APP SETUP
# ================================================================================================

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://localhost:3000"])
socketio = SocketIO(app, cors_allowed_origins=["http://localhost:5173", "http://localhost:3000"], async_mode="gevent")

# ================================================================================================
# GRAPH MODEL MANAGEMENT ENDPOINTS
# ================================================================================================

@app.route('/api/graph/models/create', methods=['POST'])
def create_cim_model():
    """
    Create a new CIM Graph model from a specific container

    Expected JSON body:
        {
            "container_id": "uuid_of_feeder_or_substation",
            "model_type": "feeder|substation|nodebreaker"
        }

    Returns:
        Model creation status and basic statistics
    """
    global CIM_NETWORK

    try:
        data = req.get_json()
        container_id = data.get('container_id')
        model_type = data.get('model_type', 'feeder')

        if not container_id:
            return jsonify({'error': 'container_id is required'}), 400

        if not CURRENT_CONNECTION:
            return jsonify({'error': 'No database connection available'}), 400

        # Create appropriate model type based on container and model type
        if model_type.lower() == 'feeder':
            # Create a feeder model
            if hasattr(cim, 'Feeder'):
                container = cim.Feeder(mRID=container_id)
                CIM_NETWORK = FeederModel(
                    connection=CURRENT_CONNECTION,
                    container=container,
                    distributed=False
                )
            else:
                return jsonify({'error': 'Feeder class not available in CIM profile'}), 500

        elif model_type.lower() == 'substation':
            # Create a substation model
            if hasattr(cim, 'Substation'):
                container = cim.Substation(mRID=container_id)
                CIM_NETWORK = BusBranchModel(
                    connection=CURRENT_CONNECTION,
                    container=container,
                    distributed=False
                )
            else:
                return jsonify({'error': 'Substation class not available in CIM profile'}), 500

        elif model_type.lower() == 'nodebreaker':
            # Create a node-breaker model
            if hasattr(cim, 'Substation'):
                container = cim.Substation(mRID=container_id)
                CIM_NETWORK = NodeBreakerModel(
                    connection=CURRENT_CONNECTION,
                    container=container,
                    distributed=False
                )
            else:
                return jsonify({'error': 'NodeBreakerModel not available'}), 500
        else:
            return jsonify({'error': f'Unsupported model type: {model_type}'}), 400

        # Get basic statistics about the created model
        stats = _get_model_statistics()

        _log.info(f"Created {model_type} model for container {container_id}")

        return jsonify({
            'success': True,
            'model_type': model_type,
            'container_id': container_id,
            'statistics': stats
        })

    except Exception as e:
        _log.error(f"Error creating model: {str(e)}")
        return jsonify({'error': str(e)}), 500

def _get_model_statistics():
    """
    Get basic statistics about the current CIM model

    Returns:
        Dictionary with model statistics
    """
    if not CIM_NETWORK or not hasattr(CIM_NETWORK, 'graph'):
        return {'total_classes': 0, 'total_objects': 0, 'class_breakdown': {}}

    class_breakdown = {}
    total_objects = 0

    for cim_class, instances in CIM_NETWORK.graph.items():
        class_name = cim_class.__name__
        instance_count = len(instances)
        class_breakdown[class_name] = instance_count
        total_objects += instance_count

    return {
        'total_classes': len(class_breakdown),
        'total_objects': total_objects,
        'class_breakdown': class_breakdown
    }

@app.route('/api/graph/data/categories', methods=['GET'])
def get_data_categories():
    """
    Get available data categories and their loading status

    Returns:
        Dictionary of data categories with loading status
    """
    try:
        return jsonify({
            'categories': DATA_CATEGORIES_LOADED,
            'model_available': CIM_NETWORK is not None
        })
    except Exception as e:
        _log.error(f"Error getting data categories: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/graph/data/load-categories', methods=['POST'])
def load_data_categories():
    """
    Load specific data categories into the current model

    Expected JSON body:
        {
            "categories": ["lines", "transformers", "loads"]
        }

    Returns:
        Loading results for each category
    """
    global DATA_CATEGORIES_LOADED

    try:
        data = req.get_json()
        categories = data.get('categories', [])

        if not categories:
            return jsonify({'error': 'No categories specified'}), 400

        if not CIM_NETWORK:
            return jsonify({'error': 'No active model available'}), 400

        results = {}

        for category in categories:
            try:
                if category == 'lines':
                    # Load line equipment (ACLineSegment, etc.)
                    _load_line_equipment()
                    DATA_CATEGORIES_LOADED['lines'] = True
                    results[category] = {'success': True, 'message': 'Lines loaded'}

                elif category == 'transformers':
                    # Load transformer equipment
                    _load_transformer_equipment()
                    DATA_CATEGORIES_LOADED['transformers'] = True
                    results[category] = {'success': True, 'message': 'Transformers loaded'}

                elif category == 'loads':
                    # Load load equipment
                    _load_load_equipment()
                    DATA_CATEGORIES_LOADED['loads'] = True
                    results[category] = {'success': True, 'message': 'Loads loaded'}

                # Add more categories as needed...
                else:
                    results[category] = {'success': False, 'message': f'Category {category} not implemented'}

            except Exception as e:
                results[category] = {'success': False, 'message': str(e)}

        return jsonify({
            'results': results,
            'categories_status': DATA_CATEGORIES_LOADED
        })

    except Exception as e:
        _log.error(f"Error loading data categories: {str(e)}")
        return jsonify({'error': str(e)}), 500

def _load_line_equipment():
    """Load line equipment into the model"""
    if hasattr(CIM_NETWORK, 'get_all_equipment'):
        CIM_NETWORK.get_all_equipment(cim.ACLineSegment)
        CIM_NETWORK.get_all_equipment(cim.OverheadWireInfo)

def _load_transformer_equipment():
    """Load transformer equipment into the model"""
    if hasattr(CIM_NETWORK, 'get_all_equipment'):
        CIM_NETWORK.get_all_equipment(cim.PowerTransformer)
        CIM_NETWORK.get_all_equipment(cim.PowerTransformerEnd)

def _load_load_equipment():
    """Load load equipment into the model"""
    if hasattr(CIM_NETWORK, 'get_all_equipment'):
        CIM_NETWORK.get_all_equipment(cim.EnergyConsumer)
        CIM_NETWORK.get_all_equipment(cim.ConformLoad)

# ================================================================================================
# CIM CLASS INSPECTION ENDPOINTS
# ================================================================================================

@app.route('/api/classes/hierarchy', methods=['GET'])
def get_class_hierarchy():
    """
    Get CIM class hierarchy from loaded graph model

    Returns:
        Hierarchical and functional organization of CIM classes with instance counts
    """
    try:
        if not CIM_NETWORK or not hasattr(CIM_NETWORK, 'graph'):
            return jsonify({'hierarchical': {}, 'functional': {'equipment': {}}, 'summary': {}})

        # Get classes that actually have instances in the graph
        loaded_classes = {}
        for cim_class, instances in CIM_NETWORK.graph.items():
            instance_count = len(instances)
            class_name = cim_class.__name__
            loaded_classes[class_name] = _get_class_metadata(cim_class, instance_count)

        # Build hierarchy relationships
        hierarchical = _build_class_hierarchy(loaded_classes)

        # Build functional groupings
        functional = _build_functional_groups(loaded_classes)

        summary = {
            'total_classes': len(loaded_classes),
            'loaded_classes': len([c for c in loaded_classes.values() if c['instance_count'] > 0]),
            'total_instances': sum(c['instance_count'] for c in loaded_classes.values())
        }

        return jsonify({
            'hierarchical': hierarchical,
            'functional': functional,
            'summary': summary
        })

    except Exception as e:
        _log.error(f"Error getting class hierarchy: {str(e)}")
        return jsonify({'error': str(e)}), 500

def _get_class_metadata(cim_class, instance_count: int) -> Dict[str, Any]:
    """
    Get detailed metadata for a CIM class

    Args:
        cim_class: The CIM class object
        instance_count: Number of instances of this class

    Returns:
        Dictionary with class metadata
    """
    metadata = {
        'name': cim_class.__name__,
        'stereotype': 'Concrete',
        'is_abstract': False,
        'parent_classes': [base.__name__ for base in cim_class.__bases__ if base != object],
        'namespace': getattr(cim_class, '__module__', 'unknown'),
        'docstring': getattr(cim_class, '__doc__', '') or '',
        'instance_count': instance_count,
        'attributes': [],
        'associations': []
    }

    # Get stereotype if available
    if hasattr(cim_class, '__stereotype__'):
        if hasattr(cim_class.__stereotype__, 'value'):
            metadata['stereotype'] = cim_class.__stereotype__.value
        else:
            metadata['stereotype'] = str(cim_class.__stereotype__)

    # Get dataclass fields if available
    if is_dataclass(cim_class):
        for field in fields(cim_class):
            field_info = {
                'name': field.name,
                'type': str(field.type),
                'field_type': field.metadata.get('type', 'Attribute')
            }

            if field.metadata.get('type') == 'Association':
                metadata['associations'].append(field_info)
            else:
                metadata['attributes'].append(field_info)

    return metadata

def _build_class_hierarchy(loaded_classes: Dict) -> Dict:
    """Build hierarchical class relationships"""
    hierarchical = {}

    for class_name, class_info in loaded_classes.items():
        hierarchical[class_name] = {
            'stereotype': class_info['stereotype'],
            'instance_count': class_info['instance_count'],
            'parent_classes': class_info['parent_classes'],
            'namespace': class_info['namespace'],
            'docstring': class_info['docstring'][:200] + '...' if len(class_info['docstring']) > 200 else class_info['docstring']
        }

    return hierarchical

def _build_functional_groups(loaded_classes: Dict) -> Dict:
    """Build functional groupings of classes"""
    functional = {
        'equipment': {},
        'connectivity': {},
        'measurements': {},
        'topology': {}
    }

    for class_name, class_info in loaded_classes.items():
        # Categorize classes based on naming patterns and inheritance
        if any(term in class_name.lower() for term in ['line', 'transformer', 'generator', 'load', 'switch', 'breaker']):
            functional['equipment'][class_name] = class_info['instance_count']
        elif any(term in class_name.lower() for term in ['node', 'terminal', 'bay']):
            functional['connectivity'][class_name] = class_info['instance_count']
        elif any(term in class_name.lower() for term in ['measurement', 'analog', 'discrete']):
            functional['measurements'][class_name] = class_info['instance_count']
        else:
            functional['topology'][class_name] = class_info['instance_count']

    return functional

@app.route('/api/classes/list', methods=['GET'])
def get_class_list():
    """
    Get list of available CIM classes with instance counts

    Returns:
        List of classes with metadata and summary statistics
    """
    try:
        hierarchy_data = get_class_hierarchy()
        if hierarchy_data.status_code != 200:
            return hierarchy_data

        hierarchy = hierarchy_data.get_json()
        classes = []

        for class_name, class_info in hierarchy.get('hierarchical', {}).items():
            classes.append({
                'name': class_name,
                'stereotype': class_info.get('stereotype', 'Concrete'),
                'instance_count': class_info.get('instance_count', 0),
                'namespace': class_info.get('namespace', ''),
                'docstring': class_info.get('docstring', '')
            })

        # Sort by name
        classes.sort(key=lambda x: x['name'])

        return jsonify({
            'classes': classes,
            'summary': hierarchy.get('summary', {})
        })

    except Exception as e:
        _log.error(f"Error getting class list: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/classes/<class_name>/schema', methods=['GET'])
def get_class_schema(class_name):
    """
    Get the dataclass schema (fields) for a specific class

    Args:
        class_name: Name of the CIM class

    Returns:
        Schema information including fields, associations, and attributes
    """
    try:
        if not hasattr(cim, class_name):
            return jsonify({'error': f'Class {class_name} not found'}), 404

        cim_class = getattr(cim, class_name)

        schema = {
            'class_name': class_name,
            'fields': [],
            'associations': [],
            'attributes': []
        }

        if is_dataclass(cim_class):
            for field in fields(cim_class):
                field_info = {
                    'name': field.name,
                    'type': str(field.type),
                    'metadata': str(field.metadata),
                    'default': str(field.default) if field.default else None,
                    'field_type': str(field.metadata.get('type', 'Attribute'))
                }

                schema['fields'].append(field_info)

                if field.metadata.get('type') == 'Association':
                    schema['associations'].append(field_info)
                else:
                    schema['attributes'].append(field_info)

        return jsonify(schema)

    except Exception as e:
        _log.error(f"Error getting class schema: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/classes/<class_name>/instances', methods=['GET'])
def get_class_instances(class_name):
    """
    Get instances of a specific class with pagination

    Args:
        class_name: Name of the CIM class

    Query parameters:
        limit: Maximum number of instances to return (default: 100)
        offset: Number of instances to skip (default: 0)

    Returns:
        Paginated list of class instances
    """
    try:
        limit = int(req.args.get('limit', 100))
        offset = int(req.args.get('offset', 0))

        if not CIM_NETWORK or not hasattr(CIM_NETWORK, 'graph'):
            return jsonify({'instances': [], 'total_count': 0, 'has_more': False})

        if not hasattr(cim, class_name):
            return jsonify({'error': f'Class {class_name} not found'}), 404

        cim_class = getattr(cim, class_name)
        if cim_class not in CIM_NETWORK.graph:
            return jsonify({'instances': [], 'total_count': 0, 'has_more': False})

        all_instances = list(CIM_NETWORK.graph[cim_class].values())
        total_count = len(all_instances)

        # Apply pagination
        start_idx = offset
        end_idx = offset + limit
        paginated_instances = all_instances[start_idx:end_idx]

        # Convert instances to summary format
        instance_summaries = [object_to_summary(obj) for obj in paginated_instances]

        return jsonify({
            'instances': instance_summaries,
            'total_count': total_count,
            'has_more': end_idx < total_count,
            'limit': limit,
            'offset': offset
        })

    except Exception as e:
        _log.error(f"Error getting class instances: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ================================================================================================
# CIM OBJECT MANAGEMENT ENDPOINTS
# ================================================================================================

@app.route('/api/objects/<uuid>', methods=['GET'])
def get_object(uuid):
    """
    Get object by UUID with full details

    Args:
        uuid: UUID of the object to retrieve

    Returns:
        Complete object information including attributes and associations
    """
    try:
        if not CIM_NETWORK:
            return jsonify({'error': 'No active model available'}), 400

        # Use GraphModel's get_object method if available
        if hasattr(CIM_NETWORK, 'get_object'):
            obj = CIM_NETWORK.get_object(uuid)
            if obj:
                detail = object_to_detail(obj)
                return jsonify({
                    'uuid': uuid,
                    'object': detail
                })
            else:
                return jsonify({'error': f'Object {uuid} not found'}), 404
        else:
            # Manual search through all objects
            for cim_class, instances in CIM_NETWORK.graph.items():
                for obj in instances.values():
                    obj_id = str(getattr(obj, 'identifier', getattr(obj, 'mRID', '')))
                    if obj_id == uuid:
                        detail = object_to_detail(obj)
                        return jsonify({
                            'uuid': uuid,
                            'object': detail
                        })

            return jsonify({'error': f'Object {uuid} not found'}), 404

    except Exception as e:
        _log.error(f"Error getting object {uuid}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/objects/create', methods=['POST'])
def create_object():
    """
    Create new CIM object

    Expected JSON body:
        {
            "class_name": "EnergyConsumer",
            "attributes": {
                "name": "New Load",
                "p": 100.0,
                "q": 50.0
            }
        }

    Returns:
        Created object information
    """
    try:
        data = req.get_json()

        class_name = data.get('class_name')
        attributes = data.get('attributes', {})

        if not class_name:
            return jsonify({'error': 'class_name is required'}), 400

        if not CIM_NETWORK:
            return jsonify({'error': 'No active model available'}), 400

        if not hasattr(cim, class_name):
            return jsonify({'error': f'Class {class_name} not found'}), 404

        cim_class = getattr(cim, class_name)

        # Use GraphModel's create method if available
        if hasattr(CIM_NETWORK, 'create'):
            new_obj = CIM_NETWORK.create(cim_class, **attributes)
            return jsonify({
                'success': True,
                'uuid': str(new_obj.identifier),
                'object': object_to_detail(new_obj)
            })
        else:
            # Manual object creation
            new_obj = cim_class(**attributes)
            # Add to graph
            if cim_class not in CIM_NETWORK.graph:
                CIM_NETWORK.graph[cim_class] = {}
            obj_id = str(getattr(new_obj, 'identifier', getattr(new_obj, 'mRID', len(CIM_NETWORK.graph[cim_class]))))
            CIM_NETWORK.graph[cim_class][obj_id] = new_obj

            return jsonify({
                'success': True,
                'uuid': obj_id,
                'object': object_to_detail(new_obj)
            })

    except Exception as e:
        _log.error(f"Error creating object: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/objects/<uuid>', methods=['PUT'])
def update_object(uuid):
    """
    Update existing CIM object

    Args:
        uuid: UUID of object to update

    Expected JSON body:
        {
            "attribute": "name",
            "value": "Updated Name"
        }

    Returns:
        Updated object information
    """
    try:
        data = req.get_json()
        attribute = data.get('attribute')
        value = data.get('value')

        if not attribute:
            return jsonify({'error': 'attribute is required'}), 400

        if not CIM_NETWORK:
            return jsonify({'error': 'No active model available'}), 400

        # Get the object first
        obj = None
        if hasattr(CIM_NETWORK, 'get_object'):
            obj = CIM_NETWORK.get_object(uuid)
        else:
            # Manual search
            for cim_class, instances in CIM_NETWORK.graph.items():
                for instance in instances.values():
                    obj_id = str(getattr(instance, 'identifier', getattr(instance, 'mRID', '')))
                    if obj_id == uuid:
                        obj = instance
                        break
                if obj:
                    break

        if not obj:
            return jsonify({'error': f'Object {uuid} not found'}), 404

        # Update the object
        if hasattr(CIM_NETWORK, 'modify'):
            CIM_NETWORK.modify(obj, attribute, value)
        else:
            # Manual update
            if hasattr(obj, attribute):
                setattr(obj, attribute, value)
            else:
                return jsonify({'error': f'Attribute {attribute} not found on object'}), 400

        return jsonify({
            'success': True,
            'uuid': uuid,
            'object': object_to_detail(obj)
        })

    except Exception as e:
        _log.error(f"Error updating object {uuid}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/objects/<uuid>', methods=['DELETE'])
def delete_object(uuid):
    """
    Delete CIM object

    Args:
        uuid: UUID of object to delete

    Returns:
        Deletion status
    """
    try:
        if not CIM_NETWORK:
            return jsonify({'error': 'No active model available'}), 400

        # Get the object first
        obj = None
        obj_class = None
        obj_key = None

        if hasattr(CIM_NETWORK, 'get_object'):
            obj = CIM_NETWORK.get_object(uuid)
        else:
            # Manual search
            for cim_class, instances in CIM_NETWORK.graph.items():
                for key, instance in instances.items():
                    obj_id = str(getattr(instance, 'identifier', getattr(instance, 'mRID', '')))
                    if obj_id == uuid:
                        obj = instance
                        obj_class = cim_class
                        obj_key = key
                        break
                if obj:
                    break

        if not obj:
            return jsonify({'error': f'Object {uuid} not found'}), 404

        # Delete the object
        if hasattr(CIM_NETWORK, 'delete'):
            CIM_NETWORK.delete(obj)
        else:
            # Manual deletion
            if obj_class and obj_key:
                del CIM_NETWORK.graph[obj_class][obj_key]

        return jsonify({
            'success': True,
            'uuid': uuid,
            'message': 'Object deleted successfully'
        })

    except Exception as e:
        _log.error(f"Error deleting object {uuid}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/objects/<uuid>/mermaid', methods=['GET'])
def get_object_mermaid(uuid):
    """
    Get Mermaid.js diagram for object relationships

    Args:
        uuid: UUID of the object

    Returns:
        Mermaid diagram string for the object and its connections
    """
    try:
        if not CIM_NETWORK:
            return jsonify({'error': 'No active model available'}), 400

        # Get the object
        obj = None
        if hasattr(CIM_NETWORK, 'get_object'):
            obj = CIM_NETWORK.get_object(uuid)

        if not obj:
            return jsonify({'error': f'Object {uuid} not found'}), 404

        # Try to use cimgraph.utils method
        try:
            mermaid_diagram = cim_utils.get_mermaid(obj)
            return jsonify({
                'uuid': uuid,
                'mermaid': mermaid_diagram
            })
        except (ImportError, AttributeError):
            # Fallback: create simple mermaid diagram
            mermaid = f"graph TD\n    {uuid}[{obj.__class__.__name__}]\n"
            return jsonify({
                'uuid': uuid,
                'mermaid': mermaid
            })

    except Exception as e:
        _log.error(f"Error getting mermaid for object {uuid}: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ================================================================================================
# SEARCH ENDPOINTS
# ================================================================================================

@app.route('/api/search/by-attribute', methods=['POST'])
def search_by_attribute():
    """
    Search objects by attribute value

    Expected JSON body:
        {
            "class_name": "EnergyConsumer",
            "attribute": "name",
            "value": "Load_1",
            "limit": 100
        }

    Returns:
        List of matching objects
    """
    try:
        data = req.get_json()

        class_name = data.get('class_name')
        attribute = data.get('attribute')
        value = data.get('value')
        limit = data.get('limit', 100)

        if not all([class_name, attribute, value is not None]):
            return jsonify({'error': 'Missing required parameters: class_name, attribute, value'}), 400

        if not CIM_NETWORK:
            return jsonify({'error': 'No active model available', 'results': []})

        if not hasattr(cim, class_name):
            return jsonify({'error': f'Class {class_name} not found', 'results': []})

        cim_class = getattr(cim, class_name)
        results = []

        # Use GraphModel's find_by_attribute method if available
        if hasattr(CIM_NETWORK, 'find_by_attribute'):
            results = CIM_NETWORK.find_by_attribute(cim_class, attribute, value)
        else:
            # Manual search
            if cim_class in CIM_NETWORK.graph:
                for obj in CIM_NETWORK.graph[cim_class].values():
                    if hasattr(obj, attribute):
                        obj_value = getattr(obj, attribute)
                        if str(obj_value) == str(value):
                            results.append(obj)

        # Apply limit
        if limit and len(results) > limit:
            results = results[:limit]
            has_more = True
        else:
            has_more = False

        # Convert to summary format
        summaries = [object_to_summary(obj) for obj in results]

        return jsonify({
            'query': {
                'class_name': class_name,
                'attribute': attribute,
                'value': value
            },
            'results': summaries,
            'total_found': len(summaries),
            'has_more': has_more,
            'success': True
        })

    except Exception as e:
        _log.error(f"Error in search by attribute: {str(e)}")
        return jsonify({'error': str(e), 'results': [], 'success': False}), 500

@app.route('/api/search/by-condition', methods=['POST'])
def search_by_condition():
    """
    Search objects by condition/predicate

    Expected JSON body:
        {
            "class_name": "EnergyConsumer",
            "attribute": "p",
            "condition": ">100",
            "limit": 100
        }

    Available conditions:
        - ">value", "<value", ">=value", "<=value" for numeric comparisons
        - "contains:text" for substring search
        - "regex:pattern" for regular expression search
        - "startswith:text", "endswith:text" for string matching

    Returns:
        List of matching objects
    """
    try:
        data = req.get_json()

        class_name = data.get('class_name')
        attribute = data.get('attribute')
        condition = data.get('condition')
        limit = data.get('limit', 100)

        if not all([class_name, attribute, condition]):
            return jsonify({'error': 'Missing required parameters: class_name, attribute, condition'}), 400

        if not CIM_NETWORK:
            return jsonify({'error': 'No active model available', 'results': []})

        if not hasattr(cim, class_name):
            return jsonify({'error': f'Class {class_name} not found', 'results': []})

        cim_class = getattr(cim, class_name)

        # Parse condition into predicate function
        predicate = parse_search_condition(condition)

        results = []

        # Use GraphModel's find_by_predicate method if available
        if hasattr(CIM_NETWORK, 'find_by_predicate'):
            results = CIM_NETWORK.find_by_predicate(cim_class, attribute, predicate)
        else:
            # Manual search
            if cim_class in CIM_NETWORK.graph:
                for obj in CIM_NETWORK.graph[cim_class].values():
                    if hasattr(obj, attribute):
                        try:
                            obj_value = getattr(obj, attribute)
                            if predicate(obj_value):
                                results.append(obj)
                        except Exception:
                            continue  # Skip objects that cause predicate errors

        # Apply limit
        if limit and len(results) > limit:
            results = results[:limit]
            has_more = True
        else:
            has_more = False

        # Convert to summary format
        summaries = [object_to_summary(obj) for obj in results]

        return jsonify({
            'query': {
                'class_name': class_name,
                'attribute': attribute,
                'condition': condition
            },
            'results': summaries,
            'total_found': len(summaries),
            'has_more': has_more,
            'success': True
        })

    except Exception as e:
        _log.error(f"Error in search by condition: {str(e)}")
        return jsonify({'error': str(e), 'results': [], 'success': False}), 500

@app.route('/api/search/advanced', methods=['POST'])
def search_advanced():
    """
    Perform advanced search with multiple criteria

    Expected JSON body:
        {
            "queries": [
                {
                    "class_name": "EnergyConsumer",
                    "attribute": "p",
                    "condition": ">100"
                },
                {
                    "class_name": "EnergyConsumer",
                    "attribute": "name",
                    "condition": "contains:Load"
                }
            ],
            "operator": "AND",  // OR "OR"
            "limit": 100
        }

    Returns:
        List of objects matching all (AND) or any (OR) of the criteria
    """
    try:
        data = req.get_json()

        queries = data.get('queries', [])
        operator = data.get('operator', 'AND')
        limit = data.get('limit', 100)

        if not queries:
            return jsonify({'error': 'No search queries provided'}), 400

        if not CIM_NETWORK:
            return jsonify({'error': 'No active model available', 'results': []})

        all_results = []

        # Execute each query
        for query in queries:
            class_name = query.get('class_name')
            attribute = query.get('attribute')

            if not hasattr(cim, class_name):
                continue

            cim_class = getattr(cim, class_name)
            query_results = []

            if 'value' in query:
                # Simple attribute search
                value = query['value']
                if cim_class in CIM_NETWORK.graph:
                    for obj in CIM_NETWORK.graph[cim_class].values():
                        if hasattr(obj, attribute):
                            obj_value = getattr(obj, attribute)
                            if str(obj_value) == str(value):
                                query_results.append(obj)

            elif 'condition' in query:
                # Condition-based search
                condition = query['condition']
                predicate = parse_search_condition(condition)

                if cim_class in CIM_NETWORK.graph:
                    for obj in CIM_NETWORK.graph[cim_class].values():
                        if hasattr(obj, attribute):
                            try:
                                obj_value = getattr(obj, attribute)
                                if predicate(obj_value):
                                    query_results.append(obj)
                            except Exception:
                                continue

            all_results.append(set(query_results))

        # Combine results based on operator
        if operator.upper() == 'AND':
            # Intersection of all result sets
            final_results = all_results[0] if all_results else set()
            for result_set in all_results[1:]:
                final_results = final_results.intersection(result_set)
        else:  # OR
            # Union of all result sets
            final_results = set()
            for result_set in all_results:
                final_results = final_results.union(result_set)

        # Convert to list and apply limit
        results_list = list(final_results)
        if limit and len(results_list) > limit:
            results_list = results_list[:limit]
            has_more = True
        else:
            has_more = False

        # Convert to summary format
        summaries = [object_to_summary(obj) for obj in results_list]

        return jsonify({
            'queries': queries,
            'operator': operator,
            'results': summaries,
            'total_found': len(summaries),
            'has_more': has_more,
            'success': True
        })

    except Exception as e:
        _log.error(f"Error in advanced search: {str(e)}")
        return jsonify({'error': str(e), 'results': [], 'success': False}), 500

# ================================================================================================
# GRAPH EXPORT AND VISUALIZATION ENDPOINTS
# ================================================================================================

@app.route('/api/graph/export', methods=['POST'])
def export_graph():
    """
    Export graph data using cim_utils.write_xml() or write_json_ld()

    Expected JSON body:
        {
            "filename": "export.xml",
            "format": "xml",  // or "jsonld"
            "description": "Export description"
        }

    Returns:
        Export status and download information
    """
    try:
        data = req.get_json()
        filename = data.get('filename', 'export.xml')
        format_type = data.get('format', 'xml')
        description = data.get('description', '')

        if not CIM_NETWORK:
            return jsonify({'error': 'No active model to export', 'success': False}), 400

        # Create temporary file
        temp_dir = tempfile.gettempdir()
        export_path = os.path.join(temp_dir, filename)

        # Export based on format
        if format_type.lower() == 'xml':
            cim_utils.write_xml(CIM_NETWORK, export_path)
        elif format_type.lower() == 'jsonld':
            cim_utils.write_json_ld(CIM_NETWORK, export_path)
        else:
            return jsonify({'error': f'Unsupported format: {format_type}', 'success': False}), 400

        _log.info(f"Graph exported to {export_path}. Description: {description}")

        return jsonify({
            'success': True,
            'filename': filename,
            'download_url': f'/api/graph/download/{filename}',
            'file_size': os.path.getsize(export_path),
            'description': description
        })

    except Exception as e:
        _log.error(f"Error exporting graph: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/graph/download/<filename>', methods=['GET'])
def download_exported_file(filename):
    """
    Download exported graph file

    Args:
        filename: Name of the exported file

    Returns:
        File download response
    """
    try:
        temp_dir = tempfile.gettempdir()
        file_path = os.path.join(temp_dir, filename)

        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404

        return send_file(file_path, as_attachment=True, download_name=filename)

    except Exception as e:
        _log.error(f"Error downloading file: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/graph/subgraph', methods=['POST'])
def get_subgraph():
    """
    Get graph data for visualization (force-directed graph)

    Expected JSON body:
        {
            "center_objects": ["uuid1", "uuid2"],  // Central objects
            "depth": 1,  // Relationship depth
            "class_filter": ["EnergyConsumer", "ACLineSegment"]  // Only these classes
        }

    Returns:
        Nodes and edges for graph visualization
    """
    try:
        data = req.get_json()

        center_objects = data.get('center_objects', [])
        depth = data.get('depth', 1)
        class_filter = data.get('class_filter', [])

        if not CIM_NETWORK:
            return jsonify({'nodes': [], 'edges': [], 'error': 'No active model'})

        nodes = []
        edges = []

        # This is a simplified implementation - you may want to enhance it
        # based on your specific visualization requirements

        # Get nodes within specified classes
        for cim_class, instances in CIM_NETWORK.graph.items():
            class_name = cim_class.__name__

            # Apply class filter if specified
            if class_filter and class_name not in class_filter:
                continue

            for obj in instances.values():
                obj_id = str(getattr(obj, 'identifier', getattr(obj, 'mRID', 'unknown')))

                nodes.append({
                    'id': obj_id,
                    'label': getattr(obj, 'name', obj_id),
                    'class': class_name,
                    'group': class_name,  # For color grouping
                })

        # Basic edge creation (you'll need to implement based on your relationship logic)
        # This is a placeholder implementation

        return jsonify({
            'nodes': nodes,
            'edges': edges,
            'parameters': {
                'center_objects': center_objects,
                'depth': depth,
                'class_filter': class_filter
            }
        })

    except Exception as e:
        _log.error(f"Error getting subgraph: {str(e)}")
        return jsonify({'error': str(e), 'nodes': [], 'edges': []}), 500

# ================================================================================================
# EXISTING GLM CONVERSION ENDPOINTS (from your original server.py)
# ================================================================================================

@app.route("/glm2json", methods=["POST"])
def glm_to_json():
    """
    Convert GridLAB-D model files (.glm) to JSON format

    Expected JSON body: List of file paths

    Returns:
        JSON string representation of the GLM files
    """
    paths = req.get_json()
    glm_dict = glm_to_dict(paths)
    return dict2json(glm_dict)

@app.route("/json2glm", methods=["POST"])
def json_to_glm():
    """
    Convert JSON GLD model representation back to GLD model (.glm)

    Expected JSON body:
        {
            "data": {...},  // GLM data
            "saveDir": "/path/to/save"
        }

    Returns:
        Status code 204 on success
    """
    if req.is_json:
        req_data = req.get_json()
        data = req_data["data"]
        save_dir = req_data["saveDir"]

        for filename in data.keys():
            with open(os.path.join(save_dir, filename), "w") as glm_file:
                glm.dump(data[filename], glm_file)
                glm_file.close()

    return "", 204

# ================================================================================================
# NETWORKX GRAPH ANALYSIS ENDPOINTS (from your original server.py)
# ================================================================================================

@app.route("/create-nx-graph", methods=["POST"])
def create_nx_graph():
    """
    Create a networkx GRAPH object for topology analysis

    Expected JSON body: Graph data or [graph_data, set_communities_bool]

    Returns:
        Community IDs if requested, otherwise status 204
    """
    graph_data = req.get_json()

    if isinstance(graph_data, dict):
        create_graph(graph_data)
        return "", 204
    elif isinstance(graph_data, list):
        # index 0 contains the data and index 1 contains a bool value whether to set the community IDs
        community_ids = create_graph(data=graph_data[0], set_communities=graph_data[1])
        return community_ids
    return None

def create_graph(data: dict, set_communities: bool=False) -> dict[Hashable | Any, Any] | None:
   global NX_GRAPH
   NX_GRAPH.clear()

   community_ids = {}

   for obj in data["objects"]:
      if obj["elementType"] == "node":
         if "id" in obj["attributes"]:
            node_id = obj["attributes"]["id"]
         elif "name" in obj["attributes"]:
            node_id = obj["attributes"]["name"]

         NX_GRAPH.add_node(node_id)
      elif obj["elementType"] == "edge":
         if "id" in obj["attributes"]:
            edge_id = obj["attributes"]["id"]
         elif "name" in obj["attributes"]:
            edge_id = obj["attributes"]["name"]

         NX_GRAPH.add_edge(obj["attributes"]["from"], obj["attributes"]["to"], edge_id)

   if set_communities :
      # favor smaller communities and stop at 151 communities
      # partition = nx.algorithms.community.greedy_modularity_communities(G=NX_GRAPH, resolution=1.42)
      partition = nx.algorithms.community.louvain_communities(G=NX_GRAPH, resolution=1.2, threshold=1.e-6, max_level=5)

      # print(f"Number of communities: {len(partition)}")

      for community_id, community in enumerate(partition):
         for node in community:
            community_ids[node] = f"CID_{community_id}"

      nx.set_node_attributes(NX_GRAPH, community_ids, "glimpse_community_id")
      return nx.get_node_attributes(G=NX_GRAPH, name="glimpse_community_id")
   return None

def get_modularity():
    """
    Calculate modularity and community detection for the NetworkX graph

    Returns:
        Dictionary with community assignments
    """
    try:
        import networkx.algorithms.community as nx_comm
        communities = nx_comm.greedy_modularity_communities(NX_GRAPH)

        community_dict = {}
        for i, community in enumerate(communities):
            for node in community:
                community_dict[node] = i

        return community_dict
    except Exception as e:
        _log.error(f"Error calculating modularity: {e}")
        return {}

@app.route("/get-stats", methods=["GET"])
def get_stats():
    """
    Get summary statistics using networkx and the existing GRAPH object

    Returns:
        Dictionary with graph statistics
    """
    summary_stats = {
        "#Nodes": NX_GRAPH.number_of_nodes(),
        "#Edges": NX_GRAPH.number_of_edges(),
        "#ConnectedComponents": nx.number_connected_components(NX_GRAPH),
        "modularity": len(get_modularity()),  # Number of communities
    }

    return summary_stats

# ================================================================================================
# CIM OBJECT UPDATE ENDPOINT (from your original server.py)
# ================================================================================================

@app.route("/update-cim-attrs", methods=["POST"])
def update_object_attributes():
    """
    Update CIM object attributes (original implementation)

    Expected JSON body:
        {
            "mRID": "object_uuid",
            "attributes": {
                "attribute_name": "new_value"
            }
        }

    Returns:
        Status code 204 on success
    """
    req_data = req.get_json()
    print(req_data)

    if not CIM_NETWORK:
        return jsonify({'error': 'No active model available'}), 400

    try:
        cim_obj = CIM_NETWORK.get_object(UUID(req_data["mRID"].upper()))

        if not cim_obj:
            return jsonify({'error': 'Object not found'}), 404

        for field in fields(cim_obj):
            if (field.metadata["type"] == "Attribute" and
                field.name in req_data["attributes"] and
                req_data["attributes"][field.name] != "None"):
                setattr(cim_obj, field.name, req_data["attributes"][field.name])

        return "", 204
    except Exception as e:
        _log.error(f"Error updating object attributes: {e}")
        return jsonify({'error': str(e)}), 500

def new_bus_location(network:FeederModel, node:cim.ConnectivityNode, xPosition:float, yPosition:float):
   for terminal in node.Terminals:
      equipment = terminal.ConductingEquipment
      location = equipment.Location
      if location is None:
         location = cim.Location(name=equipment.name+'_location')
         equipment.Location = location
         location.PowerSystemResources.append(equipment)
         network.add_to_graph(location)

      point = cim.PositionPoint()
      point.sequenceNumber = terminal.sequenceNumber
      point.xPosition = xPosition
      point.yPosition = yPosition
      point.Location = location
      location.PositionPoints.append(point)
      network.add_to_graph(point)

def export_cim_coords(new_coords_obj: list, output_path: str) -> None:
   global CIM_NETWORK

   for obj in new_coords_obj:
      c_node = CIM_NETWORK.graph[cim.ConnectivityNode][UUID(obj["mRID"].upper())]
      print(f"Updating coordinates for node {c_node.name} ({c_node.mRID}) to x: {obj['x']}, y: {obj['y']}")
      new_bus_location(network=CIM_NETWORK, node=c_node, xPosition=obj["x"], yPosition=obj["y"])

   cim_utils.get_all_data(CIM_NETWORK)
   cim_utils.write_xml(CIM_NETWORK, output_path)

def get_multi_coordinate(coords: list):
   if len(coords) == 0:
      return None

   if len(coords) <= 2:
      return max(coords)

   counts = {}
   for item in coords:
      counts[item] = counts.get(item, 0) + 1
   for item, count in counts.items():
      if count >= 2:
         return item

def find_shared_coordinates(node) -> dict:
   multi_location_x = []
   multi_location_y = []

   # Process all positions from all terminals
   for terminal in node.Terminals:
      equipment = terminal.ConductingEquipment
      if equipment.Location is not None:
         location = equipment.Location

         for point in location.PositionPoints:
            x = point.xPosition
            multi_location_x.append(x)
            y = point.yPosition
            multi_location_y.append(y)

   return {
     "x": get_multi_coordinate(multi_location_x),
     "y": get_multi_coordinate(multi_location_y)
   }

def add_attributes(cim_obj, new_obj):
   for field in fields(cim_obj):
      if field.metadata["type"] == "Attribute": # association, aggregateof, and ofaggregate
         new_obj["attributes"][field.name] = str(getattr(cim_obj, field.name))

def cim2GS(cim_filepath: str) -> str:
   """
   Converts CIM XML to GLIMPSE JSON Structure for GLIMPSE visualization
   """
   global CIM_NETWORK
   phantom_node_count = 0
   cim_file = XMLFile(cim_filepath)
   CIM_NETWORK = FeederModel(container=cim.Feeder(), connection=cim_file)
   objects = []

   for node in CIM_NETWORK.graph[cim.ConnectivityNode].values():
      coordinates = find_shared_coordinates(node)

      c_node = {
         "objectType": "c_node",
         "elementType": "node",
         "attributes": {
            "id": node.mRID,
            "name": node.name,
         }
      }

      if coordinates["x"] and coordinates["y"]:
         c_node["attributes"]["x"] = coordinates["x"]
         c_node["attributes"]["y"] = coordinates["y"]

      add_attributes(node, c_node)
      objects.append(c_node)

      for terminal in node.Terminals:
         equipment = terminal.ConductingEquipment
         eq_class_type = equipment.__class__.__name__

         if eq_class_type in LOAD_TYPES:
            new_load = {
               "objectType": "load",
               "elementType": "node",
               "attributes": {
                  "id": terminal.mRID,
                  "name": terminal.name,
                  "sequenceNumber": terminal.sequenceNumber,
                  "eq_class_type": eq_class_type
               }
            }
            add_attributes(terminal, new_load)

            objects.append(new_load)
            objects.append({
               "objectType": "line",
               "elementType": "edge",
               "attributes": {
                  "id": f"{node.mRID}_{terminal.mRID}",
                  "from": node.mRID,
                  "to": terminal.mRID
               }
            })

         if eq_class_type in GEN_TYPES:
            new_gen = {
               "objectType": "diesel_dg",
               "elementType": "node",
               "attributes": {
                  "id": terminal.mRID,
                  "name": terminal.name,
                  "sequenceNumber": terminal.sequenceNumber,
                  "eq_class_type": eq_class_type
               }
            }
            add_attributes(terminal, new_gen)

            objects.append(new_gen)
            objects.append({
               "objectType": "line",
               "elementType": "edge",
               "attributes": {
                  "id": f"{node.mRID}_{terminal.mRID}",
                  "from": node.mRID,
                  "to": terminal.mRID
               }
            })

         if eq_class_type in CAP_TYPES:
            new_cap = {
               "objectType": "capacitor",
               "elementType": "node",
               "attributes": {
                  "id": terminal.mRID,
                  "name": terminal.name,
                  "sequenceNumber": terminal.sequenceNumber,
                  "eq_class_type": eq_class_type
               }
            }
            add_attributes(terminal, new_cap)

            objects.append(new_cap)
            objects.append({
               "objectType": "line",
               "elementType": "edge",
               "attributes": {
                  "id": f"{node.mRID}_{terminal.mRID}",
                  "from": node.mRID,
                  "to": terminal.mRID
               }
            })

         if eq_class_type in INV_TYPES:
            new_inv = {
               "objectType": "inverter_dyn",
               "elementType": "node",
               "attributes": {
                  "id": terminal.mRID,
                  "name": terminal.name,
                  "sequenceNumber": terminal.sequenceNumber,
                  "eq_class_type": eq_class_type,
               }
            }
            add_attributes(terminal, new_inv)

            objects.append(new_inv)
            objects.append({
               "objectType": "line",
               "elementType": "edge",
               "attributes": {
                  "id": f"{node.mRID}_{terminal.mRID}",
                  "from": node.mRID,
                  "to": terminal.mRID
               }
            })

   CIM_NETWORK.get_all_edges(cim.ACLineSegment)
   for line in CIM_NETWORK.graph[cim.ACLineSegment].values():
      new_l = {
         "objectType": "overhead_line",
         "elementType": "edge",
         "attributes": {
            "id": line.mRID,
            "from": line.Terminals[0].ConnectivityNode.mRID,
            "to": line.Terminals[1].ConnectivityNode.mRID,
            "class_type": line.__class__.__name__,
            "length": line.length
         }
      }

      add_attributes(line, new_l)
      objects.append(new_l)

   CIM_NETWORK.get_all_edges(cim.PowerTransformer)
   CIM_NETWORK.get_all_edges(cim.PowerTransformerEnd)
   CIM_NETWORK.get_all_edges(cim.TransformerTank)
   CIM_NETWORK.get_all_edges(cim.TransformerTankEnd)

   for line in CIM_NETWORK.graph[cim.TransformerTank].values():

      new_edge = {
         "objectType": "transformer",
         "elementType": "edge",
         "attributes": {
            "id": line.mRID,
            "from": line.TransformerTankEnds[0].Terminal.ConnectivityNode.mRID,
            "to": line.TransformerTankEnds[1].Terminal.ConnectivityNode.mRID,
            "class_type": line.__class__.__name__
         }
      }

      add_attributes(line, new_edge)
      objects.append(new_edge)

   for line in CIM_NETWORK.graph[cim.PowerTransformer].values():
      if line.PowerTransformerEnd:
         if (len(line.PowerTransformerEnd) > 2):
            """
            T1 <- * -> T2
                  |
                  V
                  T3

            * : phantom node
            """
            phantom_node_id = f"phantom_node_id_{phantom_node_count}"

            objects.append({
               "objectType": "phantom_node",
               "elementType": "node",
               "attributes": {
                  "id": phantom_node_id,
                  "v": "1kV"
               }
            })

            edge_ID = f"{line.PowerTransformerEnd[0].Terminal.ConnectivityNode.mRID}_{phantom_node_id}"
            objects.append({
               "objectType": "transformer",
               "elementType": "edge",
               "attributes": {
                  "id": edge_ID,
                  "from": line.PowerTransformerEnd[0].Terminal.ConnectivityNode.mRID,
                  "to": phantom_node_id
               }
            })

            edge_ID = f"{phantom_node_id}_{line.PowerTransformerEnd[1].Terminal.ConnectivityNode.mRID}"
            objects.append({
               "objectType": "transformer",
               "elementType": "edge",
               "attributes": {
                  "id": edge_ID,
                  "from": phantom_node_id,
                  "to": line.PowerTransformerEnd[1].Terminal.ConnectivityNode.mRID
               }
            })

            edge_ID = f"{phantom_node_id}_{line.PowerTransformerEnd[2].Terminal.ConnectivityNode.mRID}"
            objects.append({
               "objectType": "transformer",
               "elementType": "edge",
               "attributes": {
                  "id": edge_ID,
                  "from": phantom_node_id,
                  "to": line.PowerTransformerEnd[2].Terminal.ConnectivityNode.mRID
               }
            })

            phantom_node_count += 1
         else:
            new_edge = {
               "objectType": "transformer",
               "elementType": "edge",
               "attributes": {
                  "id": line.mRID,
                  "from": line.PowerTransformerEnd[0].Terminal.ConnectivityNode.mRID,
                  "to": line.PowerTransformerEnd[1].Terminal.ConnectivityNode.mRID,
                  "class_type": line.__class__.__name__
               }
            }

            add_attributes(line, new_edge)
            objects.append(new_edge)

   cim_switch_types = [
      cim.Breaker,
      cim.Fuse,
      cim.Switch,
      cim.Sectionaliser,
      cim.LoadBreakSwitch,
      cim.Disconnector,
      cim.Recloser
   ]

   for cim_type in cim_switch_types:
      if cim_type in CIM_NETWORK.graph:
         for line in CIM_NETWORK.graph[cim_type].values():
            new_edge = {
               "objectType": "switch",
               "elementType": "edge",
               "attributes": {
                  "id": line.mRID,
                  "from": line.Terminals[0].ConnectivityNode.mRID,
                  "to": line.Terminals[1].ConnectivityNode.mRID,
                  "class_type": line.__class__.__name__
               }
            }

            add_attributes(line, new_edge)
            objects.append(new_edge)

   return json.dumps({cim_filepath: {"objects": objects}})

def exportCIM(dir2save: str, filename: str, data: list) -> None:
   global CIM_NETWORK

   if len(data) == 0:
      print("No objects to export, creating copy of the original file")
      cim_utils.get_all_data(CIM_NETWORK)
      cim_utils.write_xml(CIM_NETWORK, dir2save + "\\cim_output.xml")
      return

   feeder = CIM_NETWORK.container

   # [0] = new nerminal with type
   # [1] = new connectivity node
   # [2] = existing connectivity node

   for nodeObj in data:
      # 1. get existing connectivity node
      existing_c_node = CIM_NETWORK.graph[cim.ConnectivityNode][UUID(nodeObj[2]["mRID"].upper())]

      # 2. create new connectivity node
      new_c_node = cim.ConnectivityNode(mRID=nodeObj[1]["mRID"].upper(), name=nodeObj[1]["name"])
      CIM_NETWORK.add_to_graph(new_c_node)

      # 3. connect both connectivity nodes with new_two_terminal_obj function
      new_two_terminal_object(network=CIM_NETWORK, container=feeder, class_type=cim.ACLineSegment, name=existing_c_node.mRID.split("-")[0], node1=existing_c_node, node2=new_c_node)

      # 4. Finally create the new synchronous generator or energy consumer by connecting to new connectivity node
      if nodeObj[0]["type"] == "diesel_dg":
         new_synchronous_generator(network=CIM_NETWORK, container=feeder, name=nodeObj[0]["name"], node=new_c_node)
      elif nodeObj[0]["type"] == "load":
         new_energy_consumer(network=CIM_NETWORK, container=feeder, name=nodeObj[0]["name"], node=new_c_node)
      elif nodeObj[0]["type"] == "inverter_dyn":
         # new power electronics connection
         pass
      elif nodeObj[0]["type"] == "capacitor":
         # new one terminal object
         pass

   cim_utils.get_all_data(CIM_NETWORK)
   cim_utils.write_xml(CIM_NETWORK, os.path.join(dir2save, os.path.splitext(os.path.basename(filename))[0] + "_out.xml"))

@app.route("/cimg-to-GS", methods=["POST"])
def cim_to_glimpse():
  cim_filepath = req.get_json()
  glimpse_structure_data = cim2GS(cim_filepath[0])

  return glimpse_structure_data
# ================================================================================================
# WEBSOCKET EVENTS (from your original server.py)
# ================================================================================================

@socketio.on("glimpse")
def glimpse(data):
    """Handle glimpse events and broadcast updates"""
    socketio.emit("update-data", data)

@socketio.on("addNode")
def add_node(new_node_data):
    """Handle node addition events"""
    socketio.emit("add-node", new_node_data)

@socketio.on("addEdge")
def add_edge(new_edge_data):
    """Handle edge addition events"""
    socketio.emit("add-edge", new_edge_data)

@socketio.on("deleteNode")
def delete_node(node_id):
    """Handle node deletion events"""
    socketio.emit("delete-node", node_id)

@socketio.on("deleteEdge")
def delete_edge(edge_id):
    """Handle edge deletion events"""
    socketio.emit("delete-edge", edge_id)

# ================================================================================================
# HEALTH CHECK AND BASIC ENDPOINTS
# ================================================================================================

@app.route("/")
def hello():
    """Basic API information endpoint"""
    return {"api": "GLIMPSE CIM-Graph Flask Backend", "version": "2.0.0"}

@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    return {
        'status': 'healthy',
        'version': '2.0.0',
        'active_model': CIM_NETWORK is not None,
        'active_connection': CURRENT_CONNECTION is not None
    }

# ================================================================================================
# MAIN APPLICATION ENTRY POINT
# ================================================================================================

if __name__ == "__main__":
    # Start the Flask-SocketIO server
    port = int(os.environ.get('FLASK_PORT', 5051))
    _log.info(f"Starting GLIMPSE CIM-Graph server on port {port}")
    socketio.run(app, host='127.0.0.1', port=port, debug=False, log_output=True)
