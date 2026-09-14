import { Global, Module } from '@nestjs/common'; import { SubscriptionPolicyService } from './subscription-policy.service';
@Global() @Module({ providers:[SubscriptionPolicyService], exports:[SubscriptionPolicyService] }) export class SubscriptionsModule{}
