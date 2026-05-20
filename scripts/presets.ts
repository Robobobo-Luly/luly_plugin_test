export type Preset =
  | 'academy'
  | 'academy-course'
  | 'campaign-simple'
  | 'campaign-course'
  | 'waitlist'
  | 'interactive-proposal';

export const PRESET_VALUES: readonly Preset[] = [
  'academy',
  'academy-course',
  'campaign-simple',
  'campaign-course',
  'waitlist',
  'interactive-proposal',
] as const;

export interface PresetSpec {
  productType: 'academy' | 'campaign';
  flowType: 'academy' | 'campaign-simple' | 'campaign-course';
  product: 'academy' | 'campaign' | 'advanced-campaign' | 'waitlist';
  campaignType: 'simple' | 'course' | null;
  template: string;
}

export const PRESETS: Record<Preset, PresetSpec> = {
  'academy':              { productType: 'academy',  flowType: 'academy',         product: 'academy',           campaignType: null,     template: 'Product_Academy_Template.json' },
  'academy-course':       { productType: 'academy',  flowType: 'academy',         product: 'academy',           campaignType: null,     template: 'default-course.json' },
  'campaign-simple':      { productType: 'campaign', flowType: 'campaign-simple', product: 'campaign',          campaignType: 'simple', template: 'Basic_Campaign_Template.json' },
  'campaign-course':      { productType: 'campaign', flowType: 'campaign-course', product: 'advanced-campaign', campaignType: 'course', template: 'Advanced_Campaign_Template.json' },
  'waitlist':             { productType: 'campaign', flowType: 'campaign-simple', product: 'waitlist',          campaignType: 'simple', template: 'Waitlist_Campaign_Template.json' },
  'interactive-proposal': { productType: 'campaign', flowType: 'campaign-simple', product: 'campaign',          campaignType: 'simple', template: 'Interactive_Proposal_Template.json' },
};
