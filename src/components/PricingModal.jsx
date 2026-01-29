import { useTranslation } from 'react-i18next';
import './PricingModal.css';

export default function PricingModal({ isOpen, onClose }) {
    const { t } = useTranslation();

    if (!isOpen) return null;

    const plans = [
        {
            key: 'trial',
            name: t('pricing.plans.trial.name'),
            price: t('pricing.plans.trial.price'),
            period: t('pricing.plans.trial.period'),
            description: t('pricing.plans.trial.description'),
            features: [
                t('pricing.plans.trial.features.0'),
                t('pricing.plans.trial.features.1'),
                t('pricing.plans.trial.features.2'),
            ],
            buttonText: t('pricing.plans.trial.button'),
            popular: false,
        },
        {
            key: 'basic',
            name: t('pricing.plans.basic.name'),
            price: t('pricing.plans.basic.price'),
            period: t('pricing.plans.basic.period'),
            description: t('pricing.plans.basic.description'),
            features: [
                t('pricing.plans.basic.features.0'),
                t('pricing.plans.basic.features.1'),
                t('pricing.plans.basic.features.2'),
                t('pricing.plans.basic.features.3'),
            ],
            buttonText: t('pricing.plans.basic.button'),
            popular: false,
        },
        {
            key: 'pro',
            name: t('pricing.plans.pro.name'),
            price: t('pricing.plans.pro.price'),
            period: t('pricing.plans.pro.period'),
            description: t('pricing.plans.pro.description'),
            features: [
                t('pricing.plans.pro.features.0'),
                t('pricing.plans.pro.features.1'),
                t('pricing.plans.pro.features.2'),
                t('pricing.plans.pro.features.3'),
                t('pricing.plans.pro.features.4'),
            ],
            buttonText: t('pricing.plans.pro.button'),
            popular: true,
        },
    ];

    return (
        <div className="pricingOverlay" onClick={onClose}>
            <div className="pricingModal" onClick={(e) => e.stopPropagation()}>
                <button className="pricingClose" onClick={onClose} aria-label="Close">
                    ✕
                </button>

                <div className="pricingHeader">
                    <h2 className="pricingTitle">{t('pricing.title')}</h2>
                    <p className="pricingSubtitle">{t('pricing.subtitle')}</p>
                </div>

                <div className="pricingCards">
                    {plans.map((plan) => (
                        <div
                            key={plan.key}
                            className={`pricingCard ${plan.popular ? 'pricingCardPopular' : ''}`}
                        >
                            {plan.popular && (
                                <div className="pricingPopularBadge">{t('pricing.popular')}</div>
                            )}
                            <h3 className="pricingPlanName">{plan.name}</h3>
                            <div className="pricingPlanPrice">
                                <span className="pricingAmount">{plan.price}</span>
                                <span className="pricingPeriod">{plan.period}</span>
                            </div>
                            <p className="pricingPlanDesc">{plan.description}</p>

                            <ul className="pricingFeatures">
                                {plan.features.map((feature, idx) => (
                                    <li key={idx} className="pricingFeature">
                                        <span className="pricingCheck">✓</span>
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            <button className="pricingButton">{plan.buttonText}</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
