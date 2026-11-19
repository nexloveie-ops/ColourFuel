// Browsing groups describe culinary use, not dietary or nutrition claims.
export const INGREDIENT_GROUPS = [
 {id:'vegetables',label:'Vegetables',categories:['vegetable']},
 {id:'fruit',label:'Fruit & juices',categories:['fruit']},
 {id:'grains',label:'Grains',categories:['grain']},
 {id:'plant-protein',label:'Beans & tofu',categories:['pulse','soy']},
 {id:'animal-protein',label:'Meat, fish & eggs',categories:['meat','fish','egg']},
 {id:'dairy',label:'Dairy',categories:['dairy']},
 {id:'nuts-seeds',label:'Nuts & seeds',categories:['nut','seed']},
 {id:'herbs-spices',label:'Herbs & spices',categories:['herb','spice']},
 {id:'pantry',label:'Oils, sauces & pantry',categories:['oil','sauce','sweetener','water']}
];
export function ingredientGroup(food){
 if(food.ingredient_id==='chipotle')return 'herbs-spices';
 if(food.ingredient_id==='tahini')return 'pantry';
 return INGREDIENT_GROUPS.find(group=>group.categories.includes(food.category))?.id||'pantry';
}
export function browseIngredients(foods,{query='',category='all'}={}){
 const q=query.trim().toLocaleLowerCase('en-IE');
 const searched=foods.filter(food=>[food.name_en,...(food.aliases||[])].join(' ').toLocaleLowerCase('en-IE').includes(q));
 const groups=INGREDIENT_GROUPS.map(group=>({...group,items:searched.filter(food=>ingredientGroup(food)===group.id).sort((a,b)=>a.name_en.localeCompare(b.name_en,'en-IE')||a.variant_id.localeCompare(b.variant_id))}));
 return {counts:Object.fromEntries([['all',searched.length],...groups.map(group=>[group.id,group.items.length])]),groups:groups.filter(group=>(category==='all'||category===group.id)&&group.items.length)};
}
// Bowl add-ons: foods a customer can sensibly add to a ready Bowl in their listed food state.
// Raw meat/fish/egg, dry grains, sauces/condiments, sweeteners, water, spices, juices, liquid dairy and raw records of foods that need cooking stay library-only.
const NEEDS_COOKING=new Set(['potato','sweet-potato','aubergine','butternut-squash','parsnip','swede','leek']);
const LIBRARY_ONLY=new Set(['lemon-juice','orange-juice','lime-juice','tahini','whole-milk','buttermilk']);
export function isBowlAddOn(food){
 if(['sauce','sweetener','water','spice'].includes(food.category))return false;
 if(['meat','fish','egg'].includes(food.category)&&food.state==='raw')return false;
 if(food.category==='grain'&&food.state==='dry')return false;
 if(NEEDS_COOKING.has(food.ingredient_id)&&food.state==='raw')return false;
 return !LIBRARY_ONLY.has(food.ingredient_id);
}
export function groupedIngredientOptions(foods,{bowl=false}={}){
 return INGREDIENT_GROUPS.map(group=>({label:group.label,items:foods.filter(food=>ingredientGroup(food)===group.id&&(!bowl||isBowlAddOn(food))).sort((a,b)=>a.name_en.localeCompare(b.name_en,'en-IE')||a.variant_id.localeCompare(b.variant_id))})).filter(group=>group.items.length);
}
