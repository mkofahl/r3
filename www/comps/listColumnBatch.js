import {isAttributeFiles}                 from './shared/attribute.js';
import {getFirstColumnUsableAsAggregator} from './shared/column.js';
import {
	getUnixFormat,
	getUnixShifted,
	getUtcTimeStringFromUnix
} from './shared/time.js';

export default {
	name:'my-list-column-batch',
	template:`<div class="columnBatchHeader" ref="content">
		<my-button image="filter.png"
			v-if="showIconFilter"
			@trigger="click"
			@trigger-right="clear"
			:blockBubble="true"
			:captionTitle="capApp.button.columnFilters"
			:naked="true"
		/>
		
		<my-button
			v-if="showIconOrder"
			@trigger="$emit('set-order',!isOrderedAsc)"
			@trigger-right="$emit('set-order',null)"
			:blockBubble="true"
			:caption="columnBatch.orderPosition === 0 ? '' : String(columnBatch.orderPosition)"
			:captionTitle="capApp.button.columnOrderFlip"
			:image="isOrderedAsc ? 'triangleUp.png' : 'triangleDown.png'"
			:naked="true"
		/>
		
		<div class="columBatchHeaderCaption"
			v-click-outside="clickOutside"
			@click.stop="click"
			:class="{ clickable:canOpen, dropdownActive:dropdownShow, hasIcons:showIconFilter || showIconOrder }"
			:title="columnBatch.caption"
		>{{ columnBatch.caption }}</div>
		
		<teleport to="#dropdown" v-if="dropdownShow">
			<div class="columnBatchOption default-inputs" data-dropdown-border-simple data-dropdown-margin-x="-4" data-dropdown-width="320">
				<!-- sorting -->
				<div class="columnBatchOptionItem" v-if="canOrder">
					<my-button image="sort.png"
						@trigger="$emit('del-order')"
						@trigger-right="$emit('del-order')"
						:active="isOrdered"
						:captionTitle="capApp.orderBy"
						:naked="true"
					/>
					<my-button caption="\u25B2"
						@trigger="$emit('set-order',true)"
						:image="isOrderedAsc ? 'radio1.png' : 'radio0.png'"
						:naked="true"
					/>
					<my-button caption="\u25BC"
						@trigger="$emit('set-order',false)"
						:image="isOrdered && !isOrderedAsc ? 'radio1.png' : 'radio0.png'"
						:naked="true"
					/>
				</div>
				
				<!-- aggregation -->
				<div class="columnBatchOptionItem" v-if="aggrColumn !== null">
					<my-button image="sum.png"
						@trigger="aggregatorInput = ''"
						@trigger-right="aggregatorInput = ''"
						:active="aggregatorInput !== ''"
						:captionTitle="capApp.button.aggregatorsHint"
						:naked="true"
					/>
					<select v-model="aggregatorInput">
						<option value="">-</option>
						<option value="avg">{{ capGen.aggregatorItem.avg }}</option>
						<option value="count">{{ capGen.aggregatorItem.count }}</option>
						<option value="max">{{ capGen.aggregatorItem.max }}</option>
						<option value="min">{{ capGen.aggregatorItem.min }}</option>
						<option value="sum">{{ capGen.aggregatorItem.sum }}</option>
					</select>
				</div>
				
				<!-- filter by text -->
				<div class="columnBatchOptionItem" v-if="showFilterText">
					<my-button image="filter.png"
						@trigger="clear"
						@trigger-right="clear"
						:active="isFiltered && inputTxt !== ''"
						:captionTitle="capGen.button.filter"
						:naked="true"
					/>
					<input
						v-model="inputTxt"
						:placeholder="capApp.columnFilter.contains"
						@keyup.enter="useTextInput"
					/>
					<my-button image="ok.png"
						@trigger="useTextInput"
						:active="inputTxt !== ''"
						:naked="true"
					/>
				</div>
				
				<!-- filter by items -->
				<template v-if="showFilterItems">
					<div class="columnBatchOptionItem">
					<my-button
						@trigger="valueToggleAll"
						:caption="inputSel.length === values.length ? '['+capGen.button.selectNone+']' : '['+capGen.button.selectAll+']'"
						:image="inputSel.length === values.length ? 'checkbox1.png' : 'checkbox0.png'"
						:naked="true"
					/>
					<my-button
						@trigger="filterModeExclude = !filterModeExclude; $emit('set-filter-mode',filterModeExclude); this.set()"
						:image="filterModeExclude ? 'exclude.png' : 'include.png'"
						:caption="filterModeExclude ? '['+capGen.button.include+']' : '['+capGen.button.exclude+']'"
						:naked="true"
					/>
					</div>
					<div class="columnBatchOptionFilterValues">
						<my-button
							v-for="v of values"
							@trigger="valueToggle(v)"
							:adjusts="true"
							:caption="displayValue(v)"
							:image="inputSel.includes(v) ? 'checkbox1.png' : 'checkbox0.png'"
							:naked="true"
						/>
					</div>
				</template>
				
				<!-- filter actions -->
				<div class="row space-between">
					<my-button image="remove.png"
						v-if="showFilterAny"
						@trigger="clear"
						:active="isFiltered"
						:cancel="true"
						:caption="capGen.button.clear"
					/>
					<my-button image="cancel.png"
						@trigger="dropdownSet(false)"
						:cancel="true"
						:captionTitle="capGen.button.close"
					/>
				</div>
			</div>
		</teleport>
	</div>`,
	props:{
		columnBatch:     { type:Object,  required:true }, // column batch to show options for
		columnIdMapAggr: { type:Object,  required:true },
		columns:         { type:Array,   required:true }, // list columns
		filters:         { type:Array,   required:true }, // list filters all combined (columns, list, quick, user, choices, ...)
		filtersColumn:   { type:Array,   required:true }, // list filters from users column batch selections
		isOrderedOrginal:{ type:Boolean, required:true }, // list orders are the same as original defined
		joins:           { type:Array,   required:true }, // list joins
		orders:          { type:Array,   required:true }, // list orders
		relationId:      { type:String,  required:true }, // list query base relation ID
		rowCount:        { type:Number,  required:true }, // list total row count
		simpleSortOnly:  { type:Boolean, required:true }  // list column can only sort, does not dropdown or offer any other option
	},
	emits:['del-aggregator','del-order','set-aggregator','set-filters','set-order','set-order-only','set-filter-mode'],
	data() {
		return {
			inputSel:[], // value input for selection filter
			inputTxt:'', // value input for text filter
			values:[],   // values available to filter with (all values a list could have for column)
			valuesTotalCount:0, // total number of distinct values in filter column, may exceed values shown in filter
			filterModeExclude:true
		};
	},
	watch:{
		columnFilterIndexes:{
			handler(v) {
				if(v.length < 1)
					return;

				// apply input selection from column filter (must be first index)
				const f = this.filtersColumn[v[0]];
				if(f.side1.content === 'value') {
					switch(f.operator) {
						case 'ILIKE':  this.inputTxt = f.side1.value;                             break;
						case '<> ALL': this.inputSel = JSON.parse(JSON.stringify(f.side1.value)); break;
						case '= ANY':  this.inputSel = JSON.parse(JSON.stringify(f.side1.value)); break;
					}
				}

				// apply NULL from filter to selection input
				if(f.operator === '<> ALL' && v.length > 1 && this.filtersColumn[v[1]].operator === 'IS NOT NULL')
					this.inputSel.push(null);
			},
			immediate:true
		},
		dropdownShow(v) {
			if(v) this.loadSelectionValues();
		}
	},
	computed:{
		aggregatorInput:{
			get()  {
				return this.aggrColumn !== null &&
					typeof this.columnIdMapAggr[this.aggrColumn.id] !== 'undefined'
					? this.columnIdMapAggr[this.aggrColumn.id] : '';
			},
			set(v) {
				if(v === '') this.$emit('del-aggregator',this.aggrColumn.id,null);
				else         this.$emit('set-aggregator',this.aggrColumn.id,v);
			}
		},
		
		// returns column of the column batch that is used for filtering (null if none is available)
		columnUsedFilter:s => {
			for(let ind of s.columnBatch.columnIndexes) {
				let c = s.columns[ind];
				let a = s.attributeIdMap[c.attributeId];
				
				// ignore color/drawing display, sub query, aggregator, encrypted and file attribute columns
				if(a.contentUse !== 'color' && a.contentUse !== 'drawing' && c.query === null && c.aggregator === null &&
					!a.encrypted && !s.isAttributeFiles(a.content)) {
					
					return c;
				}
			}
			return null;
		},
		
		// indexes of column user filters that this column is responsible for
		columnFilterIndexes:s => {
			if(!s.isValidFilter)
				return [];
			
			let atrId    = s.columnUsedFilter.attributeId;
			let atrIndex = s.columnUsedFilter.index;
			let out      = [];
			
			for(let i = 0, j = s.filtersColumn.length; i < j; i++) {
				const f = s.filtersColumn[i];
				if(f.side0.attributeId === atrId && f.side0.attributeIndex === atrIndex)
					out.push(i);
			}
			return out;
		},
		
		// simple
		aggrColumn:       s => s.getFirstColumnUsableAsAggregator(s.columnBatch,s.columns),
		canOpen:          s => s.rowCount > 1 || s.isFiltered,
		canOrder:         s => s.columnBatch.columnIndexesSortBy.length !== 0,
		dropdownShow:     s => s.dropdownElm === s.$refs.content,
		filtersColumnThis:s => s.filtersColumn.filter((v,i) => s.columnFilterIndexes.includes(i)),
		isDateOrTime:     s => s.isValidFilter && ['datetime','date','time'].includes(s.attributeIdMap[s.columnUsedFilter.attributeId].contentUse),
		isFiltered:       s => s.columnFilterIndexes.length !== 0,
		isOrdered:        s => s.columnBatch.orderIndexesUsed.length !== 0 && !s.isOrderedOrginal,
		isOrderedAsc:     s => s.isOrdered && s.orders[s.columnBatch.orderIndexesUsed[0]].ascending,
		isValidFilter:    s => s.columnUsedFilter !== null,
		showFilterAny:    s => s.showFilterItems || s.showFilterText,
		showFilterItems:  s => s.values.length != 0,
		showFilterText:   s => !s.isDateOrTime && s.isValidFilter,
		showIconFilter:   s => s.isValidFilter && s.isFiltered,
		showIconOrder:    s => s.isOrdered && !s.isOrderedOrginal,
		
		// stores
		attributeIdMap:s => s.$store.getters['schema/attributeIdMap'],
		capApp:        s => s.$store.getters.captions.list,
		capGen:        s => s.$store.getters.captions.generic,
		dateFormat:    s => s.$store.getters.settings.dateFormat,
		dropdownElm:   s => s.$store.getters.dropdownElm
	},
	methods:{
		// externals
		getFirstColumnUsableAsAggregator,
		getUnixFormat,
		getUnixShifted,
		getUtcTimeStringFromUnix,
		isAttributeFiles,
		
		// presentation
		displayValue(v) {
			if(v === null)
				return '[' + this.capGen.button.empty + ']';
			
			const atr = this.attributeIdMap[this.columnUsedFilter.attributeId];
			
			if(atr.content === 'boolean')
				return v ? this.capGen.option.yes : this.capGen.option.no;
			
			switch(atr.contentUse) {
				case 'date':     return this.getUnixFormat(this.getUnixShifted(v,true),this.dateFormat); break;
				case 'datetime': return this.getUnixFormat(v,this.dateFormat + ' H:i');                  break;
				case 'time':     return this.getUtcTimeStringFromUnix(v);                                break;
				default: return String(v); break;
			}
		},

		// helper
		prepareDataGet() {
			return {
				relationId:this.relationId,
				joins:this.joins,
				expressions:[{
					attributeId:this.columnUsedFilter.attributeId,
					index:this.columnUsedFilter.index,
					aggregator:'first',
					distincted:true
				}],
				filters:this.filters.filter(v => {
					// remove filters coming from this column batch
					for(const f of this.filtersColumnThis) {
						if(JSON.stringify(f) === JSON.stringify(v))
							return false;
					}
					return true;
				}),
				orders:[{ascending:true,expressionPos:0}],
				limit:1000
			};
		},
		
		// actions
		clear() {
			this.inputTxt = '';
			this.inputSel = [];
			this.set();
			this.loadSelectionValues();
		},
		click() {
			if(this.simpleSortOnly) {
				if(this.isOrdered)
					return this.$emit('set-order',!this.isOrderedAsc);

				return this.$emit('set-order-only',true);
			}

			if(this.canOpen)
				this.dropdownSet(!this.dropdownShow);
		},
		clickOutside() {
			this.dropdownSet(false);	
		},
		dropdownSet(state) {
			if(state && !this.dropdownShow) this.$store.commit('dropdownElm',this.$refs.content);
			if(!state && this.dropdownShow) this.$store.commit('dropdownElm',null);
		},
		useTextInput() {
			this.inputSel = [];
			this.set();
		},
		valueToggle(v) {
			this.inputTxt = '';

			const p = this.inputSel.indexOf(v);
			if(p !== -1) this.inputSel.splice(p,1);
			else         this.inputSel.push(v);

			this.set();
		},
		valueToggleAll() {
			this.inputTxt = '';
			if(this.inputSel.length === this.values.length) {
				this.inputSel = [];
			}
			else {
				this.inputSel = JSON.parse(JSON.stringify(this.values));
			}
			this.set();
		},

		// retrieval
		loadSelectionValues() {
			if(!this.dropdownShow || !this.isValidFilter)
				return;
			
			ws.send('data','get',this.prepareDataGet(),false).then(
				res => {
					this.values = [];
					this.valuesTotalCount = res.payload.count;
					for(const row of res.payload.rows) {
						this.values.push(row.values[0]);
					}
				},
				this.$root.genericError
			);
		},
		
		// updates
		set() {
			if(!this.isValidFilter)
				return;
			
			const atrId     = this.columnUsedFilter.attributeId;
			const atrIndex  = this.columnUsedFilter.index;
			const filterTxt = this.inputTxt !== '';
			
			// remove existing filters for this column
			let filters = JSON.parse(JSON.stringify(this.filtersColumn))
				.filter((v,i) => !this.columnFilterIndexes.includes(i));

			// skip filter if both, no string is set and if item filter distinguishes from selecting all
			let doFilter = this.inputTxt !== '';
			doFilter ||= (this.filterModeExclude && this.inputSel.length !== 0 && this.values.length !== 0);
			doFilter ||= (!this.filterModeExclude && this.inputSel.length !== this.values.length && this.valuesTotalCount <= 1000);
			doFilter ||= (!this.filterModeExclude && this.valuesTotalCount > 1000);
			if(doFilter) {
				// add new filters for this column, if active
				// NULL values are not allowed in '<> ALL' operator, will make entire set NULL if included
				// remove NULL from original filter condition but add second NULL/NOT NULL condition to filter with it
				const exclNull = !filterTxt && this.inputSel.includes(null);
				const filterMode = this.filterModeExclude ? '<> ALL' : '= ANY';
				filters.push({
					connector:'AND',
					index:0,
					operator:filterTxt ? 'ILIKE' : filterMode,
					side0:{
						attributeId:atrId,
						attributeIndex:atrIndex,
						brackets:1
					},
					side1:{
						brackets:filterTxt ? 1 : 0,
						content:'value',
						value:filterTxt ? this.inputTxt : this.inputSel.filter(v => v !== null)
					}
				});
				
				if(!filterTxt) {
					filters.push({
						connector:exclNull ? 'AND' : 'OR',
						index:0,
						operator:exclNull ? 'IS NOT NULL' : 'IS NULL',
						side0:{
							attributeId:atrId,
							attributeIndex:atrIndex,
							brackets:0
						},
						side1:{
							brackets:1
						}
					});
				}
			}
			this.$emit('set-filters',filters);
		}
	}
};