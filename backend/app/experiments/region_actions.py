"""Strict, data-only regional edits. No callbacks, paths or code execution."""
from typing import Literal
from pydantic import model_validator,field_validator
from app.schemas.ai import StrictModel,Number,Vector2
from app.experiments.spatial import Region,Rectangle,Magnetic,ID
class RegionPatch(StrictModel):
    name:str|None=None
    electric_field:Vector2|None=None
    magnetic_field:Magnetic|None=None
    color:Literal['cyan','violet','amber','green']|None=None
    @model_validator(mode='after')
    def nonempty(self):
        if not self.model_fields_set or any(getattr(self,k) is None for k in self.model_fields_set):raise ValueError('Nonempty patch required')
        return self
class RegionAction(StrictModel):
    schema_version:Literal[1]
    @field_validator('schema_version',mode='before')
    @classmethod
    def version(cls,v):
        if type(v) is not int or v!=1:raise ValueError('Expected action version 1')
        return v
class AddRegion(RegionAction):
    action:Literal['add_field_region']
    region:Region
class UpdateRegion(RegionAction):
    action:Literal['update_field_region']
    region_id:ID
    changes:RegionPatch
class MoveRegion(RegionAction):
    action:Literal['move_field_region']
    region_id:ID
    x:Number;y:Number
class ResizeRegion(RegionAction):
    action:Literal['resize_field_region']
    region_id:ID
    width:Number;height:Number
class RemoveRegion(RegionAction):
    action:Literal['remove_field_region']
    region_id:ID
class ToggleRegion(RegionAction):
    action:Literal['toggle_field_region']
    region_id:ID
    enabled:bool

def apply_region(p,a):
    import copy
    p=copy.deepcopy(p);regions=p.get('regions')
    if not isinstance(regions,list):raise ValueError('Plugin has no regions')
    if a.action=='add_field_region':regions.append(a.region.model_dump());return p
    r=next((r for r in regions if r['id']==a.region_id),None)
    if r is None:raise ValueError('Unknown region ID')
    if a.action=='update_field_region':r.update(a.changes.model_dump(exclude_unset=True))
    elif a.action=='move_field_region':r['geometry'].update(x=a.x,y=a.y)
    elif a.action=='resize_field_region':r['geometry'].update(width=a.width,height=a.height)
    elif a.action=='remove_field_region':p['regions']=[x for x in regions if x['id']!=a.region_id]
    elif a.action=='toggle_field_region':r['enabled']=a.enabled
    else:raise ValueError('Unknown regional operation')
    return p
